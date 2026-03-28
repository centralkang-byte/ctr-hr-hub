// ═══════════════════════════════════════════════════════════
// POST /api/v1/payroll/[runId]/reject — 급여 결재 반려
// ═══════════════════════════════════════════════════════════
// 현재 대기 단계를 REJECTED → PayrollRun → REVIEW (재검토)
// 반려 사유 필수
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { sendNotification } from '@/lib/notifications'

const schema = z.object({
    comment: z.string().min(1, '반려 사유를 입력해 주세요.').max(1000),
})

export const POST = withPermission(
    async (req: NextRequest, context, user) => {
        const { runId } = await context.params
        const body = await req.json()
        const { comment } = schema.parse(body)

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

        const approval = run.payrollApproval
        if (!approval) throw badRequest('승인 프로세스가 아직 시작되지 않았습니다.')

        const currentStep = approval.steps.find((s) => s.status === 'PENDING')
        if (!currentStep) throw badRequest('처리 가능한 단계가 없습니다.')

        // 역할 확인
        const callerRoles = await prisma.employeeRole.findMany({
            where: {
                employeeId: user.employeeId,
                endDate: null,
                role: { code: currentStep.roleRequired },
            },
            select: { id: true },
        })
        if (callerRoles.length === 0) {
            throw forbidden(`이 단계(${currentStep.roleRequired})를 반려할 권한이 없습니다.`)
        }

        const now = new Date()

        await prisma.$transaction(async (tx) => {
            // 현재 단계 반려
            await tx.payrollApprovalStep.update({
                where: { id: currentStep.id },
                data: {
                    status: 'REJECTED',
                    approverId: user.employeeId,
                    comment,
                    decidedAt: now,
                },
            })

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
        })

        // HR 요청자에게 반려 알림
        void notifyRequester(approval.requestedBy, runId, run.yearMonth, comment)

        const { ip, userAgent } = extractRequestMeta(req.headers)
        logAudit({
            actorId: user.employeeId,
            action: 'PAYROLL_STEP_REJECTED',
            resourceType: 'PayrollApprovalStep',
            resourceId: currentStep.id,
            companyId: run.companyId,
            changes: { stepNumber: currentStep.stepNumber, roleRequired: currentStep.roleRequired, comment },
            ip,
            userAgent,
        })

        const updated = await prisma.payrollRun.findUniqueOrThrow({ where: { id: runId } })
        return apiSuccess({ payrollRun: updated, rejectedStep: currentStep.stepNumber }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.APPROVE),
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
