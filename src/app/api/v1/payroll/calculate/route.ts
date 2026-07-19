// ═══════════════════════════════════════════════════════════
// POST /api/v1/payroll/calculate — GP#3 급여 자동 계산
// ATTENDANCE_CLOSED → CALCULATING → ADJUSTMENT
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE, DOMESTIC_COMPANY_CODES } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { eventBus } from '@/lib/events/event-bus'
import { DOMAIN_EVENTS } from '@/lib/events/types'
import { calculatePayrollRun } from '@/lib/payroll/batch'

const schema = z.object({
    payrollRunId: z.string().min(1),
})

export const POST = withPermission(
    async (req: NextRequest, _context, user) => {
        const body = await req.json()
        const { payrollRunId } = schema.parse(body)

        const run = await prisma.payrollRun.findUnique({ where: { id: payrollRunId } })
        if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')

        // 멀티테넌트 가드: SUPER_ADMIN 외에는 본인 법인 급여 실행에만 접근 가능 (해외법인 체크보다 우선)
        if (user.role !== ROLE.SUPER_ADMIN && run.companyId !== user.companyId) {
            throw forbidden('다른 법인의 급여 실행에 접근할 수 없습니다.')
        }

        // GP#3 파이프라인: ATTENDANCE_CLOSED 상태에서만 계산 시작 가능
        if (run.status !== 'ATTENDANCE_CLOSED') {
            throw badRequest(
                `ATTENDANCE_CLOSED 상태에서만 급여 계산을 시작할 수 있습니다. (현재: ${run.status})`,
            )
        }

        // GP#3: 해외법인 급여 계산 차단 — 로컬 시스템에서 처리
        const company = await prisma.company.findUnique({ where: { id: run.companyId }, select: { code: true } })
        if (!company || !(DOMESTIC_COMPANY_CODES as readonly string[]).includes(company.code)) {
            throw forbidden('해외법인은 로컬 시스템에서 급여를 처리합니다.')
        }

        const result = await calculatePayrollRun(payrollRunId, {
            mode: 'gp3',
            authorizedCompanyId: run.companyId,
            actorId: user.employeeId,
        })

        void eventBus.publish(DOMAIN_EVENTS.PAYROLL_CALCULATED, {
            ctx: {
                companyId: run.companyId,
                actorId: user.employeeId,
                occurredAt: new Date(),
            },
            runId: payrollRunId,
            yearMonth: run.yearMonth,
            headcount: result.summary.headcount,
            totalGross: result.summary.totalGross,
            totalNet: result.summary.totalNet,
        })

        const { ip, userAgent } = extractRequestMeta(req.headers)
        logAudit({
            actorId: user.employeeId,
            action: 'PAYROLL_GP3_CALCULATE',
            resourceType: 'PayrollRun',
            resourceId: payrollRunId,
            companyId: run.companyId,
            changes: {
                yearMonth: run.yearMonth,
                headcount: result.summary.headcount,
                totalGross: result.summary.totalGross,
                totalNet: result.summary.totalNet,
            },
            ip,
            userAgent,
        })

        return apiSuccess(
            {
                payrollRun: result.payrollRun,
                summary: result.summary,
            },
            200,
        )
    },
    perm(MODULE.PAYROLL, ACTION.UPDATE),
)
