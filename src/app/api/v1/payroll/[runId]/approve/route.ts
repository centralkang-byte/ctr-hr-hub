// ═══════════════════════════════════════════════════════════
// POST /api/v1/payroll/[runId]/approve — GP#3-C 다단계 승인
// ═══════════════════════════════════════════════════════════
// Flow:
//  1. 첫 호출: PayrollApproval + PayrollApprovalStep 생성 (if not exists)
//  2. 현재 단계의 roleRequired를 호출자가 보유한지 확인
//  3. 해당 단계 APPROVED → 다음 단계로 advance
//  4. 마지막 단계 완료 → PayrollRun APPROVED + emit PAYROLL_APPROVED event
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/permissions'
import { apiSuccess } from '@/lib/api'
import { badRequest, conflict, notFound, forbidden } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { eventBus } from '@/lib/events/event-bus'
import { DOMAIN_EVENTS } from '@/lib/events/types'
import { sendNotification } from '@/lib/notifications'
import { callerHoldsPayrollStepRole, resolvePayrollStepRoleCodes } from '@/lib/payroll/approval-step-roles'

const schema = z.object({
    comment: z.string().max(1000).optional(),
})

// 권한: withAuth(인증만) + 인핸들러 SoD가 authz (Codex Gate 1 D2/D3/D4).
// withPermission(PAYROLL, ACTION.APPROVE)='manage' 게이트 제거 — ceo 단계 승인자
// (EXECUTIVE)는 '승인'만 필요하고 'manage'(전체 급여 운영권)는 과권한이라.
// 승인 자격(현 단계 role 보유) 검증이 곧 접근 통제. cross-company 가드는 핸들러 내 유지.
export const POST = withAuth(
    async (req: NextRequest, context, user) => {
        const { runId } = await context.params
        const body = await req.json()
        const { comment } = schema.parse(body)

        // 1. PayrollRun 조회
        const run = await prisma.payrollRun.findUnique({
            where: { id: runId },
            include: {
                payrollItems: { select: { id: true, employeeId: true } },
                payrollApproval: {
                    include: { steps: { orderBy: { stepNumber: 'asc' } } },
                },
                company: { select: { code: true, name: true } },
            },
        })
        if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')
        if (run.status !== 'PENDING_APPROVAL') {
            throw badRequest(`PENDING_APPROVAL 상태에서만 승인 가능합니다. (현재: ${run.status})`)
        }

        // Session 209 (Codex Gate 1 HIGH 2): cross-company 승인 차단.
        // withPermission은 company scope을 강제하지 않으므로 다른 법인 동일 role 보유자가
        // foreign runId를 알면 통과 가능. SUPER_ADMIN은 cross-company bypass 허용.
        if (user.role !== 'SUPER_ADMIN' && run.companyId !== user.companyId) {
            throw forbidden('다른 법인의 급여를 결재할 수 없습니다.')
        }

        // 2. 승인 단계는 submit-for-approval에서 결정적 생성됨 (Codex Gate 1 D5).
        // approve는 기존 단계를 소비만 — lazy 생성 제거(인증 전 PayrollApproval 생성·
        // requestedBy 각인으로 상태 변조 가능하던 데이터정합 구멍 차단).
        const approval = run.payrollApproval
        if (!approval) {
            throw badRequest('승인 단계가 없습니다. 먼저 승인 요청(submit-for-approval)을 진행해 주세요.')
        }

        // 3. 현재 단계 확인
        const currentStep = approval.steps.find((s) => s.status === 'PENDING')
        if (!currentStep) {
            throw badRequest('더 이상 처리할 승인 단계가 없습니다.')
        }

        // 4. 직무분리(SoD) 검증 — Codex Gate 1 D2/D3/D4
        // D4: 이전 단계 승인자와 동일인 차단 (다중 role 보유자/SUPER 단독 양단계 도장 방지) — 전원 적용.
        const priorApproverIds = approval.steps
            .filter((s) => s.status === 'APPROVED' && s.approverId)
            .map((s) => s.approverId as string)
        if (priorApproverIds.includes(user.employeeId)) {
            throw forbidden('직무분리: 이전 단계를 승인한 사람은 다음 단계를 승인할 수 없습니다.')
        }

        // D2/D3: 현 단계가 요구하는 추상 role(hr_admin/ceo/finance)을 호출자가 '보유'하는지 확인.
        // 블랭킷 HR_ADMIN override 제거 — HR_ADMIN은 hr_admin 단계만, ceo 단계는 EXECUTIVE/SUPER만.
        // SUPER_ADMIN은 긴급 대행(role 미보유 단계도 통과) 허용하되, D4(단독 양단계 불가)는 적용 + audit 기록.
        const viaSuperOverride = user.role === 'SUPER_ADMIN'
        if (!viaSuperOverride) {
            const allowed = await callerHoldsPayrollStepRole(
                currentStep.roleRequired,
                user.employeeId,
                run.companyId,
            )
            if (!allowed) {
                throw forbidden(`이 단계(${currentStep.roleRequired})를 승인할 권한이 없습니다.`)
            }
        }

        // 5. 현재 단계 승인
        const isLastStep = currentStep.stepNumber === approval.totalSteps
        const now = new Date()

        const txResult = await prisma.$transaction(async (tx) => {
            // 동시 결재 race 방어: PENDING→APPROVED atomic transition. updateMany +
            // status: 'PENDING' 조건 → READ COMMITTED row lock으로 첫 tx만 count=1,
            // 둘째는 status 미일치로 count=0 → race lost. eventBus 중복 publish +
            // PayrollRun status 중복 update + payslip 중복 생성 차단.
            const stepUpdate = await tx.payrollApprovalStep.updateMany({
                where: { id: currentStep.id, status: 'PENDING' },
                data: {
                    status: 'APPROVED',
                    approverId: user.employeeId,
                    comment: comment ?? null,
                    decidedAt: now,
                },
            })
            if (stepUpdate.count === 0) return { raceLost: true } as const

            if (isLastStep) {
                // 마지막 단계 — PayrollApproval 완료 + PayrollRun APPROVED
                await tx.payrollApproval.update({
                    where: { id: approval!.id },
                    data: { status: 'APPROVED', currentStep: currentStep.stepNumber, completedAt: now },
                })

                await tx.payrollRun.update({
                    where: { id: runId },
                    data: {
                        status: 'APPROVED',
                        approvedById: user.employeeId,
                        approvedAt: now,
                    },
                })

                // Payslip 생성 + 알림 (payrollApprovedHandler via event)
                const [yearStr, monthStr] = run.yearMonth.split('-')
                const year = parseInt(yearStr, 10)
                const month = parseInt(monthStr, 10)

                await eventBus.publish(DOMAIN_EVENTS.PAYROLL_APPROVED, {
                    ctx: { companyId: run.companyId, actorId: user.employeeId, occurredAt: now },
                    runId,
                    yearMonth: run.yearMonth,
                    year,
                    month,
                    payrollItemIds: run.payrollItems,
                }, tx)
            } else {
                // 다음 단계로 advance
                await tx.payrollApproval.update({
                    where: { id: approval!.id },
                    data: { currentStep: currentStep.stepNumber + 1 },
                })

                // 다음 승인자에게 알림 (role 기반 — HR_ADMIN 또는 해당 역할 보유자에게)
                const nextStep = approval!.steps.find(
                    (s) => s.stepNumber === currentStep.stepNumber + 1,
                )
                if (nextStep) {
                    void notifyNextApprover(nextStep.roleRequired, run.companyId, runId, run.yearMonth)
                }
            }
            return { raceLost: false } as const
        })

        if (txResult.raceLost) throw conflict('이미 처리된 결재 단계입니다.')

        // 마지막 단계 완료 시 fire-and-forget (알림 재발송 without tx)
        if (isLastStep) {
            const [yearStr, monthStr] = run.yearMonth.split('-')
            void eventBus.publish(DOMAIN_EVENTS.PAYROLL_APPROVED, {
                ctx: { companyId: run.companyId, actorId: user.employeeId, occurredAt: now },
                runId,
                yearMonth: run.yearMonth,
                year: parseInt(yearStr, 10),
                month: parseInt(monthStr, 10),
                payrollItemIds: run.payrollItems,
            })
        }

        const { ip, userAgent } = extractRequestMeta(req.headers)
        logAudit({
            actorId: user.employeeId,
            action: 'PAYROLL_STEP_APPROVED',
            resourceType: 'PayrollApprovalStep',
            resourceId: currentStep.id,
            companyId: run.companyId,
            changes: { stepNumber: currentStep.stepNumber, roleRequired: currentStep.roleRequired, isLastStep, comment, viaSuperOverride },
            ip,
            userAgent,
        })

        const updated = await prisma.payrollRun.findUniqueOrThrow({ where: { id: runId } })
        const updatedApproval = await prisma.payrollApproval.findUnique({
            where: { payrollRunId: runId },
            include: {
                steps: {
                    orderBy: { stepNumber: 'asc' },
                    include: { approver: { select: { id: true, name: true } } },
                },
            },
        })

        return apiSuccess({
            payrollRun: updated,
            approval: updatedApproval,
            isComplete: isLastStep,
        }, 200)
    },
)

// ─── 다음 승인자 알림 헬퍼 ──────────────────────────────────

async function notifyNextApprover(
    roleCode: string,
    companyId: string,
    runId: string,
    yearMonth: string,
): Promise<void> {
    try {
        // 추상 step role('ceo' 등)을 실제 role.code(['SUPER_ADMIN','EXECUTIVE'])로 해석.
        // (finance 단계는 권한 기반이라 미커버 — 기본 flow[hr_admin→ceo]엔 없음.)
        const codes = resolvePayrollStepRoleCodes(roleCode)
        const nextApprovers = await prisma.employee.findMany({
            where: {
                // role도 해당 법인 scope으로 한정 — callerHoldsPayrollStepRole과 일치시켜
                // 타 법인에서만 해당 role을 가진 사람에게 알림(runId·yearMonth)이 새지 않게 (Codex G2 P1).
                employeeRoles: {
                    some: {
                        companyId,
                        role: { code: { in: codes } },
                        endDate: null,
                    },
                },
                assignments: {
                    some: { companyId, isPrimary: true, endDate: null, status: 'ACTIVE' },
                },
            },
            select: { id: true },
            take: 5, // Settings-connected: approval notification max recipients (default: 5)
        })

        for (const emp of nextApprovers) {
            void sendNotification({
                employeeId: emp.id,
                triggerType: 'payroll_approval_needed',
                title: `${yearMonth} 급여 승인 필요`,
                body: `${yearMonth} 급여 결재를 진행해 주세요.`,
                titleKey: 'notifications.payrollApprovalNeeded.title',
                bodyKey: 'notifications.payrollApprovalNeeded.body',
                bodyParams: { yearMonth },
                link: `/payroll/${runId}/approve`,
                priority: 'high',
                metadata: { payrollRunId: runId, yearMonth },
            })
        }
    } catch {
        // notification failure should not block
    }
}
