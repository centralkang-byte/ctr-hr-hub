// ═══════════════════════════════════════════════════════════
// POST /api/v1/payroll/calculate — GP#3 급여 자동 계산
// ATTENDANCE_CLOSED → CALCULATING → ADJUSTMENT
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, DOMESTIC_COMPANY_CODES } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { eventBus } from '@/lib/events/event-bus'
import { DOMAIN_EVENTS } from '@/lib/events/types'
import { calculatePayrollForEmployee } from '@/lib/payroll/calculator'
import type { PayrollItemDetail } from '@/lib/payroll/types'

const CONCURRENCY = 10

async function processInBatches<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<R>,
): Promise<R[]> {
    const results: R[] = []
    for (let i = 0; i < items.length; i += concurrency) {
        const batch = items.slice(i, i + concurrency)
        const batchResults = await Promise.all(batch.map(fn))
        results.push(...batchResults)
    }
    return results
}

const schema = z.object({
    payrollRunId: z.string().min(1),
})

export const POST = withPermission(
    async (req: NextRequest, _context, user) => {
        const body = await req.json()
        const { payrollRunId } = schema.parse(body)

        const run = await prisma.payrollRun.findUnique({ where: { id: payrollRunId } })
        if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')

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

        // status → CALCULATING
        await prisma.payrollRun.update({
            where: { id: payrollRunId },
            data: { status: 'CALCULATING' },
        })

        try {
            // 재직자 조회 (제외 직원 목록 적용)
            const excludedIds = run.excludedEmployeeIds ?? []

            const employees = await prisma.employee.findMany({
                where: {
                    id: { notIn: excludedIds },
                    hireDate: { lte: run.periodEnd },
                    assignments: {
                        some: {
                            companyId: run.companyId,
                            status: 'ACTIVE',
                            isPrimary: true,
                            endDate: null,
                        },
                    },
                },
                select: { id: true },
            })

            // 전월 PayrollRun 조회
            const [prevYearNum, prevMonthNum] = run.yearMonth.split('-').map(Number)
            const prevDate = new Date(prevYearNum, prevMonthNum - 2, 1)
            const prevYearMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`

            const prevRun = await prisma.payrollRun.findFirst({
                where: {
                    companyId: run.companyId,
                    yearMonth: prevYearMonth,
                    status: { not: 'CANCELLED' },
                },
                orderBy: { createdAt: 'desc' },
            })

            // 병렬 계산
            const results = await processInBatches(
                employees,
                CONCURRENCY,
                async (emp) => {
                    const detail = await calculatePayrollForEmployee(
                        emp.id,
                        run.periodStart,
                        run.periodEnd,
                        run.companyId,
                    )
                    return { employeeId: emp.id, detail }
                },
            )

            // PayrollItem upsert
            let totalGross = 0
            let totalDeductions = 0
            let totalNet = 0

            await prisma.$transaction(
                results.map(({ employeeId, detail }: { employeeId: string; detail: PayrollItemDetail }) => {
                    totalGross += detail.grossPay
                    totalDeductions += detail.totalDeductions
                    totalNet += detail.netPay

                    return prisma.payrollItem.upsert({
                        where: { id: `${payrollRunId}-${employeeId}` },
                        create: {
                            id: `${payrollRunId}-${employeeId}`,
                            runId: payrollRunId,
                            employeeId,
                            baseSalary: detail.earnings.baseSalary,
                            overtimePay: detail.earnings.overtimePay,
                            bonus: detail.earnings.bonuses,
                            allowances:
                                detail.earnings.mealAllowance +
                                detail.earnings.transportAllowance +
                                detail.earnings.fixedOvertimeAllowance +
                                detail.earnings.otherEarnings,
                            grossPay: detail.grossPay,
                            deductions: detail.totalDeductions,
                            netPay: detail.netPay,
                            currency: 'KRW',
                            detail: JSON.parse(JSON.stringify(detail)),
                        },
                        update: {
                            baseSalary: detail.earnings.baseSalary,
                            overtimePay: detail.earnings.overtimePay,
                            bonus: detail.earnings.bonuses,
                            allowances:
                                detail.earnings.mealAllowance +
                                detail.earnings.transportAllowance +
                                detail.earnings.fixedOvertimeAllowance +
                                detail.earnings.otherEarnings,
                            grossPay: detail.grossPay,
                            deductions: detail.totalDeductions,
                            netPay: detail.netPay,
                            detail: JSON.parse(JSON.stringify(detail)),
                            isManuallyAdjusted: false,
                            adjustmentReason: null,
                        },
                    })
                }),
            )

            // PayrollRun 총계 + status → ADJUSTMENT
            const updated = await prisma.payrollRun.update({
                where: { id: payrollRunId },
                data: {
                    totalGross,
                    totalDeductions,
                    totalNet,
                    headcount: employees.length,
                    status: 'ADJUSTMENT',
                    previousMonthRunId: prevRun?.id ?? null,
                },
            })

            // 이벤트 발행
            void eventBus.publish(DOMAIN_EVENTS.PAYROLL_CALCULATED, {
                ctx: {
                    companyId: run.companyId,
                    actorId: user.employeeId,
                    occurredAt: new Date(),
                },
                runId: payrollRunId,
                yearMonth: run.yearMonth,
                headcount: employees.length,
                totalGross,
                totalNet,
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
                    headcount: employees.length,
                    totalGross,
                    totalNet,
                },
                ip,
                userAgent,
            })

            return apiSuccess({
                payrollRun: updated,
                summary: {
                    headcount: employees.length,
                    totalGross,
                    totalDeductions,
                    totalNet,
                    previousRunId: prevRun?.id ?? null,
                },
            }, 200)
        } catch (error) {
            // 실패 시 ATTENDANCE_CLOSED로 복귀
            await prisma.payrollRun.update({
                where: { id: payrollRunId },
                data: { status: 'ATTENDANCE_CLOSED' },
            })
            throw error
        }
    },
    perm(MODULE.PAYROLL, ACTION.UPDATE),
)
