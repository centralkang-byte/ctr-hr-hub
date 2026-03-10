// ═══════════════════════════════════════════════════════════
// POST /api/v1/payroll/attendance-reopen — 근태 마감 해제
// ATTENDANCE_CLOSED → DRAFT
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

const schema = z.object({
    payrollRunId: z.string().min(1),
})

export const POST = withPermission(
    async (req: NextRequest, _context, user) => {
        const body = await req.json()
        const { payrollRunId } = schema.parse(body)

        const run = await prisma.payrollRun.findUnique({ where: { id: payrollRunId } })
        if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')

        if (run.status !== 'ATTENDANCE_CLOSED') {
            throw badRequest(
                `ATTENDANCE_CLOSED 상태에서만 마감 해제가 가능합니다. (현재: ${run.status})`,
            )
        }

        const updated = await prisma.payrollRun.update({
            where: { id: payrollRunId },
            data: {
                status: 'DRAFT',
                attendanceClosedAt: null,
                attendanceClosedBy: null,
                excludedEmployeeIds: [],
            },
        })

        void eventBus.publish(DOMAIN_EVENTS.PAYROLL_ATTENDANCE_REOPENED, {
            ctx: {
                companyId: run.companyId,
                actorId: user.employeeId,
                occurredAt: new Date(),
            },
            payrollRunId,
            companyId: run.companyId,
            yearMonth: run.yearMonth,
        })

        const { ip, userAgent } = extractRequestMeta(req.headers)
        logAudit({
            actorId: user.employeeId,
            action: 'PAYROLL_ATTENDANCE_REOPEN',
            resourceType: 'PayrollRun',
            resourceId: payrollRunId,
            companyId: run.companyId,
            changes: { yearMonth: run.yearMonth, previousStatus: 'ATTENDANCE_CLOSED' },
            ip,
            userAgent,
        })

        return apiSuccess({ payrollRun: updated }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.UPDATE),
)
