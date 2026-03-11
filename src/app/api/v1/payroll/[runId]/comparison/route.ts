// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/[runId]/comparison — 전월 대비 비교표
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'

const querySchema = z.object({
    sortBy: z.enum(['name', 'department', 'currentNet', 'diffNet', 'diffPercent']).default('name'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
    department: z.string().optional(),
    anomalyOnly: z.coerce.boolean().default(false),
})

export interface ComparisonRow {
    employeeId: string
    employeeNo: string
    employeeName: string
    department: string
    position: string

    currentBaseSalary: number
    currentGross: number
    currentDeductions: number
    currentNet: number

    previousGross: number | null
    previousDeductions: number | null
    previousNet: number | null

    diffNet: number
    diffPercent: number

    changeReason: string | null
    hasAnomaly: boolean
    isManuallyAdjusted: boolean
}

export const GET = withPermission(
    async (req: NextRequest, context, user) => {
        const { runId } = await context.params
        const url = new URL(req.url)
        const { sortBy, sortOrder, department, anomalyOnly } = querySchema.parse(
            Object.fromEntries(url.searchParams),
        )

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
                        id: true, name: true, employeeNo: true, hireDate: true,
                        assignments: {
                            where: { isPrimary: true, endDate: null },
                            take: 1,
                            include: {
                                department: { select: { id: true, name: true } },
                                position: { select: { id: true, titleKo: true } },
                            },
                        },
                    },
                },
            },
        })

        // 전월 PayrollItems (previousMonthRunId 사용)
        const prevItemMap = new Map<string, { grossPay: number; deductions: number; netPay: number }>()
        if (run.previousMonthRunId) {
            const prevItems = await prisma.payrollItem.findMany({
                where: { runId: run.previousMonthRunId },
                select: { employeeId: true, grossPay: true, deductions: true, netPay: true },
            })
            for (const p of prevItems) {
                prevItemMap.set(p.employeeId, {
                    grossPay: Number(p.grossPay),
                    deductions: Number(p.deductions),
                    netPay: Number(p.netPay),
                })
            }
        }

        // 이상 항목 존재 직원 Set
        const anomalyEmployeeIds = new Set(
            (await prisma.payrollAnomaly.findMany({
                where: { payrollRunId: runId },
                select: { employeeId: true },
            })).map((a) => a.employeeId)
        )

        // 퇴사 예정자 Set (해당 월 내 lastWorkingDate)
        const [firstDay, lastDay] = [run.periodStart, run.periodEnd]
        const offboardingEmployeeIds = new Set(
            (await prisma.employeeOffboarding.findMany({
                where: {
                    status: { in: ['IN_PROGRESS', 'COMPLETED'] },
                    lastWorkingDate: { gte: firstDay, lte: lastDay },
                },
                select: { employeeId: true },
            })).map((o) => o.employeeId)
        )

        // 해당 월 무급휴가 직원별 일수
        const unpaidLeaveMap = new Map<string, number>()
        const unpaidLeaves = await prisma.leaveRequest.findMany({
            where: {
                status: 'APPROVED',
                startDate: { lte: lastDay },
                endDate: { gte: firstDay },
                employee: { assignments: { some: { companyId: run.companyId, isPrimary: true } } },
            },
            select: { employeeId: true, days: true },
        })
        for (const l of unpaidLeaves) {
            unpaidLeaveMap.set(l.employeeId, (unpaidLeaveMap.get(l.employeeId) ?? 0) + Number(l.days ?? 0))
        }

        // 비교 행 생성
        const rows: ComparisonRow[] = []

        for (const item of items) {
            const emp = item.employee
            const assignment = emp.assignments?.[0]
            const deptName = assignment?.department?.name ?? '—'
            const posName = (assignment?.position as { titleKo?: string } | null)?.titleKo ?? '—'

            if (department && deptName !== department) continue

            const currentGross = Number(item.grossPay)
            const currentDeductions = Number(item.deductions)
            const currentNet = Number(item.netPay)

            const prev = prevItemMap.get(emp.id) ?? null
            const prevNet = prev?.netPay ?? null

            const diffNet = prev ? currentNet - prev.netPay : 0
            const diffPercent = prev && prev.netPay > 0
                ? Math.round((diffNet / prev.netPay) * 1000) / 10
                : 0

            // 변동 사유 자동 감지
            let changeReason: string | null = null
            const hireDate = emp.hireDate ? new Date(emp.hireDate) : null
            void hireDate
            if (!prev) {
                changeReason = '신규입사 (일할계산)'
            } else if (offboardingEmployeeIds.has(emp.id)) {
                changeReason = '퇴사예정자'
            } else if (unpaidLeaveMap.has(emp.id)) {
                changeReason = `무급휴가 ${unpaidLeaveMap.get(emp.id)}일`
            } else if (item.isManuallyAdjusted && item.adjustmentReason) {
                changeReason = item.adjustmentReason
            } else {
                // 초과근무 비교
                const detail = item.detail as Record<string, unknown> | null
                if (detail?.overtime) {
                    const ot = detail.overtime as Record<string, unknown>
                    const otHours = Number(ot.totalOvertimeHours ?? 0)
                    // Settings-connected: overtime change detection threshold (default: 5 hours)
                    if (otHours > 5) {
                        changeReason = `초과근무 ${Math.round(otHours)}시간`
                    }
                }
            }

            if (diffPercent > 30 || diffPercent < -30) {
                changeReason = changeReason ?? '급여 급변동'
            }

            const hasAnomaly = anomalyEmployeeIds.has(emp.id)
            if (anomalyOnly && !hasAnomaly) continue

            rows.push({
                employeeId: emp.id,
                employeeNo: emp.employeeNo ?? '',
                employeeName: emp.name,
                department: deptName,
                position: posName,
                currentBaseSalary: Number(item.baseSalary),
                currentGross,
                currentDeductions,
                currentNet,
                previousGross: prev?.grossPay ?? null,
                previousDeductions: prev?.deductions ?? null,
                previousNet: prevNet,
                diffNet,
                diffPercent,
                changeReason,
                hasAnomaly,
                isManuallyAdjusted: item.isManuallyAdjusted,
            })
        }

        // 정렬
        rows.sort((a, b) => {
            let aVal: string | number = 0
            let bVal: string | number = 0
            if (sortBy === 'name') { aVal = a.employeeName; bVal = b.employeeName }
            else if (sortBy === 'department') { aVal = a.department; bVal = b.department }
            else if (sortBy === 'currentNet') { aVal = a.currentNet; bVal = b.currentNet }
            else if (sortBy === 'diffNet') { aVal = a.diffNet; bVal = b.diffNet }
            else if (sortBy === 'diffPercent') { aVal = a.diffPercent; bVal = b.diffPercent }

            if (typeof aVal === 'string') {
                return sortOrder === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal)
            }
            return sortOrder === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal
        })

        // 요약
        const currentTotal = rows.reduce((s, r) => s + r.currentNet, 0)
        const previousTotal = rows.reduce((s, r) => s + (r.previousNet ?? r.currentNet), 0)
        const diff = currentTotal - previousTotal
        const diffPct = previousTotal > 0 ? Math.round((diff / previousTotal) * 1000) / 10 : 0

        return apiSuccess({
            rows,
            summary: {
                currentTotal,
                previousTotal,
                diff,
                diffPercent: diffPct,
                employeesIncreased: rows.filter((r) => r.diffNet > 0).length,
                employeesDecreased: rows.filter((r) => r.diffNet < 0).length,
                employeesUnchanged: rows.filter((r) => r.diffNet === 0).length,
                yearMonth: run.yearMonth,
            },
        }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.VIEW),
)
