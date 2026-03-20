// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/[runId]/export/comparison
// 전월 대비 비교표 Excel 다운로드
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { notFound } from '@/lib/errors'
import { apiError } from '@/lib/api'
import {
    generateComparisonExcel,
    buildExcelFilename,
    type ComparisonExcelRow,
} from '@/lib/payroll/excel-generators'
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

export const GET = withRateLimit(withPermission(
    async (_req: NextRequest, context, user) => {
        try {
            const { runId } = await context.params

            const run = await prisma.payrollRun.findFirst({
                where: { id: runId, companyId: user.companyId },
            })
            if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')

            // 현재 PayrollItems
            const items = await prisma.payrollItem.findMany({
                where: { runId },
                include: {
                    employee: {
                        select: {
                            id: true, name: true, employeeNo: true,
                            assignments: {
                                where: { isPrimary: true, endDate: null }, take: 1,
                                include: { department: { select: { name: true } } },
                            },
                        },
                    },
                },
            })

            // 전월 PayrollItems
            const prevItemMap = new Map<string, { netPay: number }>()
            let prevYearMonth = ''
            if (run.previousMonthRunId) {
                const prevRun = await prisma.payrollRun.findUnique({
                    where: { id: run.previousMonthRunId },
                    select: { yearMonth: true },
                })
                prevYearMonth = prevRun?.yearMonth ?? ''

                const prevItems = await prisma.payrollItem.findMany({
                    where: { runId: run.previousMonthRunId },
                    select: { employeeId: true, netPay: true },
                })
                for (const p of prevItems) prevItemMap.set(p.employeeId, { netPay: Number(p.netPay) })
            }

            // 이상 항목 직원 Set
            const anomalySet = new Set(
                (await prisma.payrollAnomaly.findMany({
                    where: { payrollRunId: runId }, select: { employeeId: true },
                })).map((a) => a.employeeId)
            )

            const rows: ComparisonExcelRow[] = items.map((item) => {
                const emp = item.employee
                const currentNet = Number(item.netPay)
                const prev = prevItemMap.get(emp.id)
                const diffNet = prev ? currentNet - prev.netPay : 0
                const diffPct = prev && prev.netPay > 0 ? Math.round((diffNet / prev.netPay) * 1000) / 10 : 0

                return {
                    employeeNo: emp.employeeNo ?? '',
                    employeeName: emp.name,
                    department: extractPrimaryAssignment(emp.assignments)?.department?.name ?? '—',
                    currentNet,
                    previousNet: prev?.netPay ?? null,
                    diffNet,
                    diffPercent: diffPct,
                    changeReason: item.isManuallyAdjusted ? (item.adjustmentReason ?? '수동조정') : null,
                    hasAnomaly: anomalySet.has(emp.id),
                    yearMonth: run.yearMonth,
                    previousYearMonth: prevYearMonth,
                }
            })

            const currentTotal = rows.reduce((s, r) => s + r.currentNet, 0)
            const previousTotal = rows.reduce((s, r) => s + (r.previousNet ?? r.currentNet), 0)
            const diff = currentTotal - previousTotal

            const buffer = generateComparisonExcel(run.yearMonth, rows, {
                currentTotal,
                previousTotal,
                diff,
                diffPercent: previousTotal > 0 ? Math.round((diff / previousTotal) * 1000) / 10 : 0,
                employeesIncreased: rows.filter((r) => r.diffNet > 0).length,
                employeesDecreased: rows.filter((r) => r.diffNet < 0).length,
                employeesUnchanged: rows.filter((r) => r.diffNet === 0).length,
            })

            const filename = buildExcelFilename(run.companyId, run.yearMonth, 'comparison')

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
