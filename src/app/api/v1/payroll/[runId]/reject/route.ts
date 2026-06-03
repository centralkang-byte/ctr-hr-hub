// ═══════════════════════════════════════════════════════════
// POST /api/v1/payroll/[runId]/reject — 급여 결재 반려
// ═══════════════════════════════════════════════════════════
// 현재 대기 단계를 REJECTED → PayrollRun → REVIEW (재검토)
// 반려 사유 필수
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/permissions'
import { callerHoldsPayrollStepRole } from '@/lib/payroll/approval-step-roles'
import { apiSuccess } from '@/lib/api'
import { badRequest, conflict, notFound, forbidden } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { sendNotification } from '@/lib/notifications'

const schema = z.object({
    comment: z.string().min(1, '반려 사유를 입력해 주세요.').max(1000),
})

// 권한: withAuth(인증) + 인핸들러 SoD가 authz (approve와 동일). 미들웨어 rbac-spec이
// payroll 모듈 coarse 게이트(HR_UP) 제공. 비-HR 승인자(EXECUTIVE) reachability는 별 PR.
export const POST = withAuth(
    async (req: NextRequest, context, user) => {
        const { runId } = await context.params
        let body: unknown
        try {
            body = await req.json()
        } catch {
            throw badRequest('요청 본문이 올바른 JSON 형식이 아닙니다.')
        }
        const parsed = schema.safeParse(body)
        if (!parsed.success) {
            throw badRequest('반려 사유를 입력해 주세요.')
        }
        const { comment } = parsed.data

        const run = await prisma.payrollRun.findUnique({
            where: { id: runId },
            include: {
                payrollApproval: {
                    include: { steps: { orderBy: { stepNumber: 'asc' } } },
                },
            },
        })
        if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')
        if (run.status !== 'PENDING_APPROVAL') {
            throw badRequest(`PENDING_APPROVAL 상태에서만 반려 가능합니다. (현재: ${run.status})`)
        }

        // Session 209 (Codex Gate 1 HIGH 2): cross-company 반려 차단.
        // SUPER_ADMIN은 cross-company bypass 허용.
        if (user.role !== 'SUPER_ADMIN' && run.companyId !== user.companyId) {
            throw forbidden('다른 법인의 급여를 결재할 수 없습니다.')
        }

        const approval = run.payrollApproval
        if (!approval) throw badRequest('승인 프로세스가 아직 시작되지 않았습니다.')

        const currentStep = approval.steps.find((s) => s.status === 'PENDING')
        if (!currentStep) throw badRequest('처리 가능한 단계가 없습니다.')

        // 직무분리(SoD) 검증 — approve와 동일 정책 (Codex Gate 1 D2/D4).
        // D4: 이전 단계를 승인한 사람은 후속 단계를 반려할 수 없음 (단독 통제 방지).
        const priorApproverIds = approval.steps
            .filter((s) => s.status === 'APPROVED' && s.approverId)
            .map((s) => s.approverId as string)
        if (priorApproverIds.includes(user.employeeId)) {
            throw forbidden('직무분리: 이전 단계를 승인한 사람은 다음 단계를 반려할 수 없습니다.')
        }
        // D2: 현 단계가 요구하는 추상 role(hr_admin/ceo/finance) 보유 확인. SUPER_ADMIN은 긴급 대행.
        const viaSuperOverride = user.role === 'SUPER_ADMIN'
        if (!viaSuperOverride) {
            const allowed = await callerHoldsPayrollStepRole(
                currentStep.roleRequired,
                user.employeeId,
                run.companyId,
            )
            if (!allowed) {
                throw forbidden(`이 단계(${currentStep.roleRequired})를 반려할 권한이 없습니다.`)
            }
        }

        const now = new Date()

        // 동시 결재 race 방어: PENDING→REJECTED atomic transition. mixed approve/reject
        // 동시 클릭 + reject double-click 시 PayrollRun.status 중복 update + 알림 중복 차단.
        const txResult = await prisma.$transaction(async (tx) => {
            const stepUpdate = await tx.payrollApprovalStep.updateMany({
                where: { id: currentStep.id, status: 'PENDING' },
                data: {
                    status: 'REJECTED',
                    approverId: user.employeeId,
                    comment,
                    decidedAt: now,
                },
            })
            if (stepUpdate.count === 0) return { raceLost: true } as const

            // PayrollApproval 상태 반려
            await tx.payrollApproval.update({
                where: { id: approval.id },
                data: { status: 'REJECTED', completedAt: now },
            })

            // PayrollRun → REVIEW (재검토)
            await tx.payrollRun.update({
                where: { id: runId },
                data: { status: 'REVIEW' },
            })
            return { raceLost: false } as const
        })

        if (txResult.raceLost) throw conflict('이미 처리된 결재 단계입니다.')

        // HR 요청자에게 반려 알림
        void notifyRequester(approval.requestedBy, runId, run.yearMonth, comment)

        const { ip, userAgent } = extractRequestMeta(req.headers)
        logAudit({
            actorId: user.employeeId,
            action: 'PAYROLL_STEP_REJECTED',
            resourceType: 'PayrollApprovalStep',
            resourceId: currentStep.id,
            companyId: run.companyId,
            changes: { stepNumber: currentStep.stepNumber, roleRequired: currentStep.roleRequired, comment, viaSuperOverride },
            ip,
            userAgent,
        })

        const updated = await prisma.payrollRun.findUniqueOrThrow({ where: { id: runId } })
        return apiSuccess({ payrollRun: updated, rejectedStep: currentStep.stepNumber }, 200)
    },
)

async function notifyRequester(
    requestedBy: string,
    runId: string,
    yearMonth: string,
    reason: string,
): Promise<void> {
    try {
        void sendNotification({
            employeeId: requestedBy,
            triggerType: 'payroll_approval_rejected',
            title: `${yearMonth} 급여 결재 반려`,
            body: `반려 사유: ${reason.slice(0, 80)}${reason.length > 80 ? '…' : ''}`,
            titleKey: 'notifications.payrollApprovalRejected.title',
            bodyKey: 'notifications.payrollApprovalRejected.body',
            bodyParams: { yearMonth, reason: reason.slice(0, 80) },
            link: `/payroll/${runId}/review`,
            priority: 'high',
            metadata: { payrollRunId: runId, yearMonth },
        })
    } catch {
        // silent
    }
}
