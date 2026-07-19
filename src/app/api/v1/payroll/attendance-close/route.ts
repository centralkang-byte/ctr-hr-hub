// ═══════════════════════════════════════════════════════════
// POST /api/v1/payroll/attendance-close — 근태 마감
// 근태 잠금 후 PayrollRun 생성/갱신 → ATTENDANCE_CLOSED
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { extractRequestMeta } from '@/lib/audit'
import { eventBus } from '@/lib/events/event-bus'
import { DOMAIN_EVENTS } from '@/lib/events/types'
import { resolveCompanyId } from '@/lib/api/companyFilter'
import { closeAttendancePeriod } from '@/lib/payroll/attendance-period-service'

const schema = z.object({
    companyId: z.string().min(1),
    year: z.number().int().min(2020).max(2099),
    month: z.number().int().min(1).max(12),
    excludeEmployeeIds: z.array(z.string()).default([]),
}).strict()

export const POST = withPermission(
    async (req: NextRequest, _context, user) => {
        let body: unknown
        try {
            body = await req.json()
        } catch {
            throw badRequest('요청 본문이 올바른 JSON 형식이 아닙니다.')
        }
        const parsed = schema.safeParse(body)
        if (!parsed.success) throw badRequest('입력값이 올바르지 않습니다.')
        const { companyId: requestedCompanyId, year, month, excludeEmployeeIds } = parsed.data
        // 멀티테넌트: SUPER_ADMIN만 타 법인 지정 가능, 그 외는 본인 법인 강제
        const companyId = resolveCompanyId(user, requestedCompanyId)

        const yearMonth = `${year}-${String(month).padStart(2, '0')}`
        const { ip, userAgent } = extractRequestMeta(req.headers)
        const result = await closeAttendancePeriod({
            companyId, year, month, excludeEmployeeIds,
            actorId: user.employeeId, ip, userAgent,
        })

        // 이벤트 발행
        void eventBus.publish(DOMAIN_EVENTS.PAYROLL_ATTENDANCE_CLOSED, {
            ctx: { companyId, actorId: user.employeeId, occurredAt: new Date() },
            payrollRunId: result.payrollRun.id,
            companyId,
            yearMonth,
            year,
            month,
            totalEmployees: result.summary.totalEmployees,
            confirmedCount: result.summary.confirmedCount,
            excludedCount: excludeEmployeeIds.length,
        })

        return apiSuccess(result, 200)
    },
    perm(MODULE.PAYROLL, ACTION.UPDATE),
)
