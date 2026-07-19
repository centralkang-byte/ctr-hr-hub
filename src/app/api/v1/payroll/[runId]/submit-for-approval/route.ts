// ═══════════════════════════════════════════════════════════
// POST /api/v1/payroll/[runId]/submit-for-approval
// REVIEW → PENDING_APPROVAL 전환
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden, notFound } from '@/lib/errors'
import { extractRequestMeta } from '@/lib/audit'
import { eventBus } from '@/lib/events/event-bus'
import { DOMAIN_EVENTS } from '@/lib/events/types'
import { sendNotification } from '@/lib/notifications'
import { resolveApprovalFlow } from '@/lib/approval/resolve-approval-flow'
import {
    updatePayrollRunInPhase,
    withLockedPayrollRunPhase,
} from '@/lib/payroll/phase-writer-service'

const schema = z.object({
    note: z.string().max(1000).optional(),
})

export const POST = withPermission(
    async (req: NextRequest, context, user) => {
        const { runId } = await context.params
        let body: unknown = {}
        try {
            const raw = await req.text()
            body = raw ? JSON.parse(raw) : {}
        } catch {
            throw badRequest('요청 본문이 올바른 JSON 형식이 아닙니다.')
        }
        const parsed = schema.safeParse(body)
        if (!parsed.success) {
            throw badRequest('잘못된 요청 데이터입니다.')
        }
        const { note } = parsed.data

        const candidate = await prisma.payrollRun.findUnique({
            where: { id: runId },
            select: { id: true, companyId: true, yearMonth: true },
        })
        if (!candidate) throw notFound('급여 실행을 찾을 수 없습니다.')

        // 멀티테넌트 가드: SUPER_ADMIN 외에는 본인 법인 급여 실행에만 접근 가능
        if (user.role !== ROLE.SUPER_ADMIN && candidate.companyId !== user.companyId) {
            throw forbidden('다른 법인의 급여 실행에 접근할 수 없습니다.')
        }

        // 승인 플로우 해석 (ApprovalFlow SSOT). payroll run은 전사 단위이므로
        // dept_head/direct_manager(대상 직원 1명 필요)는 부적합 — hr_admin/ceo/finance
        // 등 회사 단위 role만 의미.
        // Codex Gate 2 #1: 재무 통제 → fail-CLOSED. flow 미설정 시 1인 승인 fallback 금지(거부).
        const resolvedSteps = await resolveApprovalFlow('payroll', candidate.companyId)
        if (resolvedSteps.length === 0) {
            throw badRequest(
                '급여 결재 플로우가 설정되지 않았습니다. 설정 > 결재 플로우에서 payroll 단계를 구성한 뒤 다시 시도하세요.',
            )
        }
        const chain: string[] = resolvedSteps.map((s) => s.approverRole ?? 'hr_admin')

        const { ip, userAgent } = extractRequestMeta(req.headers)
        const updated = await withLockedPayrollRunPhase({
            candidate,
            expectedStatus: 'REVIEW',
            operation: 'payroll-submit-for-approval',
            statusError: (status) =>
                `REVIEW 상태에서만 승인 요청이 가능합니다. (현재: ${status})`,
            mutate: async (tx, run) => {
                const openAnomalyCount = await tx.payrollAnomaly.count({
                    where: { payrollRunId: runId, status: 'OPEN' },
                })
                if (openAnomalyCount > 0) {
                    throw badRequest(
                        `미해소 이상 항목 ${openAnomalyCount}건이 있습니다. 모두 처리 후 승인 요청하세요.`,
                    )
                }

                const existing = await tx.payrollApproval.findUnique({
                    where: { payrollRunId: runId },
                    select: { id: true },
                })
                if (existing) {
                    await tx.payrollApprovalStep.deleteMany({
                        where: { approvalId: existing.id },
                    })
                    await tx.payrollApproval.delete({ where: { id: existing.id } })
                }
                await tx.payrollApproval.create({
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
                })
                await updatePayrollRunInPhase(tx, run, 'REVIEW', {
                    status: 'PENDING_APPROVAL',
                    notes: note ?? null,
                })
                await tx.auditLog.create({
                    data: {
                        actorId: user.employeeId,
                        action: 'PAYROLL_SUBMIT_FOR_APPROVAL',
                        resourceType: 'PayrollRun',
                        resourceId: runId,
                        companyId: run.companyId,
                        changes: { yearMonth: run.yearMonth, note: note ?? null },
                        ipAddress: ip ?? null,
                        userAgent: userAgent ?? null,
                    },
                })
                return tx.payrollRun.findUniqueOrThrow({ where: { id: runId } })
            },
        })

        // HR_ADMIN + SUPER_ADMIN에게 알림
        try {
            const approvers = await prisma.employee.findMany({
                where: {
                    employeeRoles: {
                        some: {
                            role: { code: { in: ['HR_ADMIN', 'SUPER_ADMIN'] } },
                            endDate: null,
                        },
                    },
                    assignments: {
                        some: { companyId: updated.companyId, isPrimary: true, endDate: null, status: 'ACTIVE' },
                    },
                },
                select: { id: true },
                take: 10,
            })

            for (const approver of approvers) {
                void sendNotification({
                    employeeId: approver.id,
                    triggerType: 'payroll_pending_approval',
                    title: `${updated.yearMonth} 급여 승인 요청`,
                    body: `${updated.yearMonth} 급여(${updated.headcount}명, ${Number(updated.totalNet).toLocaleString()}원)에 대한 승인을 요청합니다.`,
                    titleKey: 'notifications.payrollPendingApproval.title',
                    bodyKey: 'notifications.payrollPendingApproval.body',
                    bodyParams: { yearMonth: updated.yearMonth, headcount: updated.headcount, totalNet: Number(updated.totalNet).toLocaleString() },
                    link: `/payroll/${runId}/review`,
                    priority: 'high',
                    metadata: { payrollRunId: runId, yearMonth: updated.yearMonth },
                })
            }
        } catch {
            // notification failure should not block
        }

        void eventBus.publish(DOMAIN_EVENTS.PAYROLL_PUBLISHED, {
            ctx: {
                companyId: updated.companyId,
                actorId: user.employeeId,
                occurredAt: new Date(),
            },
            payrollRunId: runId,
            companyId: updated.companyId,
            yearMonth: updated.yearMonth,
            headcount: updated.headcount ?? 0,
            publishedAt: new Date(),
        })

        return apiSuccess({ payrollRun: updated }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.UPDATE),
)
