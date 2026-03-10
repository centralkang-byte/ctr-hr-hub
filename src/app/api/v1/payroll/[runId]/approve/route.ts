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
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { eventBus } from '@/lib/events/event-bus'
import { DOMAIN_EVENTS } from '@/lib/events/types'
import { sendNotification } from '@/lib/notifications'
import { getApprovalChain } from '@/lib/payroll/approval-chains'

const schema = z.object({
    comment: z.string().max(1000).optional(),
})

export const POST = withPermission(
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

        // 2. PayrollApproval 없으면 생성 (첫 번째 승인자 호출 시)
        // TODO: Move to Settings (Payroll) — 법인별 승인 체계 — getApprovalChain()으로 조회
        const chain = getApprovalChain(run.company?.code ?? null)
        let approval = run.payrollApproval

        if (!approval) {
            // 처음 접근 — Approval + Steps 일괄 생성
            approval = await prisma.payrollApproval.create({
                data: {
                    payrollRunId: runId,
                    totalSteps: chain.length,
                    status: 'IN_PROGRESS',
                    requestedBy: user.employeeId,
                    steps: {
                        create: chain.map((role, idx) => ({
                            stepNumber: idx + 1,
                            roleRequired: role,
                        })),
                    },
                },
                include: { steps: { orderBy: { stepNumber: 'asc' } } },
            })
        }

        // 3. 현재 단계 확인
        const currentStep = approval.steps.find((s) => s.status === 'PENDING')
        if (!currentStep) {
            throw badRequest('더 이상 처리할 승인 단계가 없습니다.')
        }

        // 4. 호출자의 역할 확인
        const callerRoles = await prisma.employeeRole.findMany({
            where: {
                employeeId: user.employeeId,
                endDate: null,
                role: { code: currentStep.roleRequired },
            },
            select: { id: true },
        })
        if (callerRoles.length === 0) {
            throw forbidden(
                `이 단계(${currentStep.roleRequired})를 승인할 권한이 없습니다.`,
            )
        }

        // 5. 현재 단계 승인
        const isLastStep = currentStep.stepNumber === approval.totalSteps
        const now = new Date()

        await prisma.$transaction(async (tx) => {
            // 단계 승인
            await tx.payrollApprovalStep.update({
                where: { id: currentStep.id },
                data: {
                    status: 'APPROVED',
                    approverId: user.employeeId,
                    comment: comment ?? null,
                    decidedAt: now,
                },
            })

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
                        approvedBy: user.employeeId,
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
        })

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
            changes: { stepNumber: currentStep.stepNumber, roleRequired: currentStep.roleRequired, isLastStep, comment },
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
    perm(MODULE.PAYROLL, ACTION.APPROVE),
)

// ─── 다음 승인자 알림 헬퍼 ──────────────────────────────────

async function notifyNextApprover(
    roleCode: string,
    companyId: string,
    runId: string,
    yearMonth: string,
): Promise<void> {
    try {
        const nextApprovers = await prisma.employee.findMany({
            where: {
                employeeRoles: {
                    some: {
                        role: { code: roleCode },
                        endDate: null,
                    },
                },
                assignments: {
                    some: { companyId, isPrimary: true, endDate: null, status: 'ACTIVE' },
                },
            },
            select: { id: true },
            take: 5, // TODO: Move to Settings (Payroll) — 승인 알림 최대 수신자 수
        })

        for (const emp of nextApprovers) {
            void sendNotification({
                employeeId: emp.id,
                triggerType: 'payroll_approval_needed',
                title: `${yearMonth} 급여 승인 필요`,
                body: `${yearMonth} 급여 결재를 진행해 주세요.`,
                link: `/payroll/${runId}/approve`,
                priority: 'high',
                metadata: { payrollRunId: runId, yearMonth },
            })
        }
    } catch {
        // notification failure should not block
    }
}
