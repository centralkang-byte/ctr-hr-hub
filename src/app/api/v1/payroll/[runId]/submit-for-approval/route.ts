// ═══════════════════════════════════════════════════════════
// POST /api/v1/payroll/[runId]/submit-for-approval
// REVIEW → PENDING_APPROVAL 전환
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { eventBus } from '@/lib/events/event-bus'
import { DOMAIN_EVENTS } from '@/lib/events/types'
import { sendNotification } from '@/lib/notifications'

const schema = z.object({
    note: z.string().max(1000).optional(),
})

export const POST = withPermission(
    async (req: NextRequest, context, user) => {
        const { runId } = await context.params
        const body = await req.json()
        const { note } = schema.parse(body)

        const run = await prisma.payrollRun.findUnique({
            where: { id: runId },
            include: {
                adjustments: { select: { id: true } },
            },
        })
        if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')
        if (run.status !== 'REVIEW') {
            throw badRequest(`REVIEW 상태에서만 승인 요청이 가능합니다. (현재: ${run.status})`)
        }

        // 미해소 이상 항목 존재 시 거부
        const openAnomalyCount = await prisma.payrollAnomaly.count({
            where: { payrollRunId: runId, status: 'OPEN' },
        })
        if (openAnomalyCount > 0) {
            throw badRequest(
                `미해소 이상 항목 ${openAnomalyCount}건이 있습니다. 모두 처리 후 승인 요청하세요.`,
            )
        }

        // PENDING_APPROVAL로 전환
        const updated = await prisma.$transaction(async (tx) => {
            const payrollRun = await tx.payrollRun.update({
                where: { id: runId },
                data: {
                    status: 'PENDING_APPROVAL',
                    notes: note ?? null,
                },
            })
            return payrollRun
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
                        some: { companyId: run.companyId, isPrimary: true, endDate: null, status: 'ACTIVE' },
                    },
                },
                select: { id: true },
                take: 10,
            })

            for (const approver of approvers) {
                void sendNotification({
                    employeeId: approver.id,
                    triggerType: 'payroll_pending_approval',
                    title: `${run.yearMonth} 급여 승인 요청`,
                    body: `${run.yearMonth} 급여(${run.headcount}명, ${Number(run.totalNet).toLocaleString()}원)에 대한 승인을 요청합니다.`,
                    link: `/payroll/${runId}/review`,
                    priority: 'high',
                    metadata: { payrollRunId: runId, yearMonth: run.yearMonth },
                })
            }
        } catch {
            // notification failure should not block
        }

        void eventBus.publish(DOMAIN_EVENTS.PAYROLL_PUBLISHED, {
            ctx: {
                companyId: run.companyId,
                actorId: user.employeeId,
                occurredAt: new Date(),
            },
            payrollRunId: runId,
            companyId: run.companyId,
            yearMonth: run.yearMonth,
            headcount: run.headcount ?? 0,
            publishedAt: new Date(),
        })

        const { ip, userAgent } = extractRequestMeta(req.headers)
        logAudit({
            actorId: user.employeeId,
            action: 'PAYROLL_SUBMIT_FOR_APPROVAL',
            resourceType: 'PayrollRun',
            resourceId: runId,
            companyId: run.companyId,
            changes: { yearMonth: run.yearMonth, note },
            ip,
            userAgent,
        })

        return apiSuccess({ payrollRun: updated }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.UPDATE),
)
