// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PAYROLL_REVIEW_READY Handler
// src/lib/events/handlers/payroll-review-ready.handler.ts
// ═══════════════════════════════════════════════════════════

import { logAudit } from '@/lib/audit'
import { sendNotification } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'
import type { DomainEventHandler, PayrollReviewReadyPayload, TxClient } from '../types'
import { DOMAIN_EVENTS } from '../types'

export const payrollReviewReadyHandler: DomainEventHandler<'PAYROLL_REVIEW_READY'> = {
    eventName: DOMAIN_EVENTS.PAYROLL_REVIEW_READY,

    async handle(payload: PayrollReviewReadyPayload, _tx?: TxClient): Promise<void> {
        void logAudit({
            actorId: payload.ctx.actorId,
            action: 'payroll.review.ready',
            resourceType: 'PayrollRun',
            resourceId: payload.payrollRunId,
            companyId: payload.companyId,
            changes: {
                yearMonth: payload.yearMonth,
                anomalyCount: payload.anomalyCount,
            },
        })

        // HR 어드민들에게 이상 검토 요청 알림
        try {
            const hrAdmins = await prisma.employee.findMany({
                where: {
                    assignments: {
                        some: { companyId: payload.companyId, isPrimary: true, endDate: null, status: 'ACTIVE' },
                    },
                    employeeRoles: {
                        some: {
                            role: { code: { in: ['HR_ADMIN', 'SUPER_ADMIN'] } },
                            endDate: null,
                        },
                    },
                },
                select: { id: true },
                take: 10,
            })

            const anomalyMsg = payload.anomalyCount > 0
                ? `이상 항목 ${payload.anomalyCount}건을 검토하세요.`
                : `이상 항목 없음. 결재를 진행하세요.`

            for (const admin of hrAdmins) {
                void sendNotification({
                    employeeId: admin.id,
                    triggerType: 'payroll_review_ready',
                    title: `${payload.yearMonth} 급여 이상 검토 준비`,
                    body: anomalyMsg,
                    link: `/payroll/review`,
                    priority: payload.anomalyCount > 0 ? 'high' : 'normal',
                    metadata: { payrollRunId: payload.payrollRunId, anomalyCount: payload.anomalyCount },
                })
            }
        } catch {
            // notification failure should not block
        }
    },
}
