// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/[runId]/export/ledger — 급여대장 Excel
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { notFound } from '@/lib/errors'
import { apiError } from '@/lib/api'
import { generateLedgerExcel, buildExcelFilename, type LedgerRow } from '@/lib/payroll/excel-generators'
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
                            id: true, name: true, employeeNo: true,
                            assignments: {
                                where: { isPrimary: true, endDate: null }, take: 1,
                                include: {
                                    department: { select: { name: true } },
                                    jobGrade: { select: { name: true } },
                                },
                            },
                        },
                    },
                },
                orderBy: { employee: { name: 'asc' } },
            })

            const rows: LedgerRow[] = items.map((item) => {
                const emp = item.employee
                const assignment = emp.assignments?.[0]
                const detail = item.detail as unknown as PayrollItemDetail | null

                const ded = detail?.deductions
                return {
                    employeeNo: emp.employeeNo ?? '',
                    employeeName: emp.name,
                    department: assignment?.department?.name ?? '—',
                    jobGrade: assignment?.jobGrade?.name ?? '—',
                    baseSalary: Number(item.baseSalary),
                    overtimePay: Number(item.overtimePay),
                    nightPay: Number(detail?.earnings?.nightShiftPay ?? 0),
                    holidayPay: Number(detail?.earnings?.holidayPay ?? 0),
                    positionAllowance: Number(detail?.earnings?.fixedOvertimeAllowance ?? 0),
                    mealAllowance: Number(detail?.earnings?.mealAllowance ?? 0),
                    transportAllowance: Number(detail?.earnings?.transportAllowance ?? 0),
                    grossPay: Number(item.grossPay),
                    nationalPension: Number(ded?.nationalPension ?? 0),
                    healthInsurance: Number(ded?.healthInsurance ?? 0),
                    longTermCare: Number(ded?.longTermCare ?? 0),
                    employmentInsurance: Number(ded?.employmentInsurance ?? 0),
                    incomeTax: Number(ded?.incomeTax ?? 0),
                    localIncomeTax: Number(ded?.localIncomeTax ?? 0),
                    totalDeductions: Number(item.deductions),
                    netPay: Number(item.netPay),
                }
            })

            const buffer = generateLedgerExcel(run.yearMonth, rows)
            const filename = buildExcelFilename(run.companyId, run.yearMonth, 'ledger')

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
