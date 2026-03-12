// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PAYROLL_ATTENDANCE_CLOSED Handler
// src/lib/events/handlers/payroll-attendance-closed.handler.ts
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: auto-triggers payroll calculation after attendance close
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════

import { logAudit } from '@/lib/audit'
import { sendNotification } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'
import type { DomainEventHandler, PayrollAttendanceClosedPayload, TxClient } from '../types'
import { DOMAIN_EVENTS } from '../types'

export const payrollAttendanceClosedHandler: DomainEventHandler<'PAYROLL_ATTENDANCE_CLOSED'> = {
    eventName: DOMAIN_EVENTS.PAYROLL_ATTENDANCE_CLOSED,

    async handle(payload: PayrollAttendanceClosedPayload, _tx?: TxClient): Promise<void> {
        // Audit log
        void logAudit({
            actorId: payload.ctx.actorId,
            action: 'payroll.attendance.closed',
            resourceType: 'PayrollRun',
            resourceId: payload.payrollRunId,
            companyId: payload.companyId,
            changes: {
                yearMonth: payload.yearMonth,
                totalEmployees: payload.totalEmployees,
                confirmedCount: payload.confirmedCount,
                excludedCount: payload.excludedCount,
            },
        })

        // HR 어드민에게 알림 발송 (근태 마감 완료)
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

            for (const admin of hrAdmins) {
                void sendNotification({
                    employeeId: admin.id,
                    triggerType: 'payroll_attendance_closed',
                    title: `${payload.yearMonth} 근태 마감 완료`,
                    body: `${payload.confirmedCount}/${payload.totalEmployees}명 확정. 급여 계산을 진행하세요.`,
                    link: `/payroll/calculate`,
                    priority: 'normal',
                    metadata: { payrollRunId: payload.payrollRunId, yearMonth: payload.yearMonth },
                })
            }
        } catch {
            // notification failure should not block the main flow
        }
    },
}
