// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/[runId]/export/journal — 인건비 전표 Excel
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { notFound } from '@/lib/errors'
import { apiError } from '@/lib/api'
import { generateJournalExcel, buildExcelFilename, type JournalRow } from '@/lib/payroll/excel-generators'
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import type { PayrollItemDetail } from '@/lib/payroll/types'

export const GET = withRateLimit(withPermission(
    async (_req: NextRequest, context, user) => {
        try {
            const { runId } = await context.params

            const run = await prisma.payrollRun.findFirst({
                where: { id: runId, companyId: user.companyId },
            })
            if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')

            const items = await prisma.payrollItem.findMany({
                where: { runId },
                include: {
                    employee: {
                        select: {
                            assignments: {
                                where: { isPrimary: true, endDate: null }, take: 1,
                                include: { department: { select: { name: true } } },
                            },
                        },
                    },
                },
            })

            // 부서별 집계
            const deptMap = new Map<string, JournalRow>()

            for (const item of items) {
                const deptName = item.employee.assignments?.[0]?.department?.name ?? '미분류'
                const detail = item.detail as unknown as PayrollItemDetail | null
                const ded = detail?.deductions

                const existing = deptMap.get(deptName) ?? {
                    department: deptName, basePay: 0, allowances: 0, welfare: 0, socialInsurance: 0, retirement: 0, total: 0,
                }

                const basePay = Number(item.baseSalary) + Number(item.overtimePay)
                const allowances = Number(item.allowances)
                // Settings-connected: welfare benefit items (default: meal + transport allowance)
                const welfare = Number(detail?.earnings?.mealAllowance ?? 0) + Number(detail?.earnings?.transportAllowance ?? 0)
                const socialInsurance = Number(ded?.nationalPension ?? 0) + Number(ded?.healthInsurance ?? 0) + Number(ded?.longTermCare ?? 0) + Number(ded?.employmentInsurance ?? 0)
                // Settings-connected: retirement fund ratio (statutory: 1/12 of gross per month)
                const retirement = Math.round(Number(item.grossPay) / 12)

                deptMap.set(deptName, {
                    department: deptName,
                    basePay: existing.basePay + basePay,
                    allowances: existing.allowances + allowances,
                    welfare: existing.welfare + welfare,
                    socialInsurance: existing.socialInsurance + socialInsurance,
                    retirement: existing.retirement + retirement,
                    total: existing.total + Number(item.grossPay) + socialInsurance + retirement,
                })
            }

            const rows: JournalRow[] = [...deptMap.values()].sort((a, b) =>
                a.department.localeCompare(b.department)
            )

            const buffer = generateJournalExcel(run.yearMonth, rows)
            const filename = buildExcelFilename(run.companyId, run.yearMonth, 'journal')

            return new NextResponse(buffer, {
                status: 200,
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
                },
            })
        } catch (err) {
            return apiError(err)
        }
    },
    perm(MODULE.PAYROLL, ACTION.VIEW),
), RATE_LIMITS.EXPORT)
