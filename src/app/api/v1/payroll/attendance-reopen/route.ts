// ═══════════════════════════════════════════════════════════
// POST /api/v1/payroll/attendance-reopen — 근태 마감 해제
//
// Supported source states (cascading cleanup):
//   ATTENDANCE_CLOSED → DRAFT (기본)
//   ADJUSTMENT → DRAFT (계산 결과 + 이상 목록 초기화)
//   REVIEW → DRAFT (이상 목록 + 승인 체인 초기화)
//
// Preserved: PayrollAdjustment records (수동 조정은 유지)
// Cleared:   PayrollAnomaly records, allAnomaliesResolved flag,
//            PayrollApproval (if REVIEW→DRAFT), calculated totals
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
import { reopenAttendancePeriod } from '@/lib/payroll/attendance-period-service'

const schema = z.object({
    payrollRunId: z.string().min(1),
    reason: z.string().max(500).optional(),        // 마감 해제 사유 (감사 로그용)
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
        const { payrollRunId, reason } = parsed.data

        const run = await prisma.payrollRun.findUnique({ where: { id: payrollRunId } })
        if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')

        // 멀티테넌트 가드: SUPER_ADMIN 외에는 본인 법인 급여 실행에만 접근 가능
        if (user.role !== ROLE.SUPER_ADMIN && run.companyId !== user.companyId) {
            throw forbidden('다른 법인의 급여 실행에 접근할 수 없습니다.')
        }

        const { ip, userAgent } = extractRequestMeta(req.headers)
        const result = await reopenAttendancePeriod({
            payrollRunId,
            companyId: run.companyId,
            actorId: user.employeeId,
            reason,
            ip,
            userAgent,
        })

        void eventBus.publish(DOMAIN_EVENTS.PAYROLL_ATTENDANCE_REOPENED, {
            ctx: { companyId: run.companyId, actorId: user.employeeId, occurredAt: new Date() },
            payrollRunId,
            companyId: run.companyId,
            yearMonth: run.yearMonth,
        })

        return apiSuccess(result, 200)
    },
    perm(MODULE.PAYROLL, ACTION.UPDATE),
)
