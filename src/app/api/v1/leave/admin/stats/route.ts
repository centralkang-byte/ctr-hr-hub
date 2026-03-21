// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Admin Stats API (F-3 Enhanced)
// GET /api/v1/leave/admin/stats
//
// Returns:
//   - KPI: usage rate, avg remaining, negative count, pending count
//   - Department usage breakdown
//   - Remaining days distribution (histogram)
//   - Burn-down forecast (monthly)
//   - Negative balance employees list
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)

    const queryCompanyId = searchParams.get('companyId')
    const companyId =
      user.role === ROLE.SUPER_ADMIN && queryCompanyId
        ? queryCompanyId
        : user.companyId

    const yearParam = searchParams.get('year')
    const year = yearParam ? Number(yearParam) : new Date().getFullYear()

    // ── 1. Get all employees for this company ──────────────

    const employees = await prisma.employee.findMany({
      where: {
        deletedAt: null,
        assignments: {
          some: { companyId, isPrimary: true, endDate: null },
        },
      },
      select: {
        id: true,
        name: true,
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          select: {
            departmentId: true,
            department: { select: { name: true } },
          },
        },
      },
    })

    const empIds = employees.map((e) => e.id)
    const empMap = new Map(employees.map((e) => [e.id, e]))

    // ── 2. Get all balances for this year ──────────────────

    const balances = await prisma.employeeLeaveBalance.findMany({
      where: {
        employeeId: { in: empIds },
        year,
      },
      include: {
        policy: { select: { name: true, leaveType: true } },
      },
    })

    // ── 3. Negative balance limit from LeaveSetting ───────
    const leaveSetting = await prisma.leaveSetting.findFirst({
      where: { companyId },
    })
    const negativeBalanceLimit = leaveSetting?.negativeBalanceLimit ?? 0

    // ── 4. KPI calculations ───────────────────────────────

    let totalGranted = 0
    let totalUsed = 0
    let totalRemaining = 0
    let negativeCount = 0
    let negativeTotalDays = 0
    const employeeRemainingMap = new Map<string, number>()
    const negativeEmployees: Array<{
      employeeId: string
      name: string
      department: string
      negativeDays: number
      limit: number
    }> = []

    for (const b of balances) {
      const granted = Number(b.grantedDays) + Number(b.carryOverDays)
      const used = Number(b.usedDays)
      const remaining = granted - used

      totalGranted += granted
      totalUsed += used

      const prevRemaining = employeeRemainingMap.get(b.employeeId) ?? 0
      employeeRemainingMap.set(b.employeeId, prevRemaining + remaining)
    }

    // Process per-employee aggregates
    for (const [empId, remaining] of employeeRemainingMap.entries()) {
      totalRemaining += remaining

      if (remaining < 0) {
        negativeCount++
        negativeTotalDays += remaining // negative number

        const emp = empMap.get(empId)
        const assignment = extractPrimaryAssignment(emp?.assignments ?? [])

        negativeEmployees.push({
          employeeId: empId,
          name: emp?.name ?? '알 수 없음',
          department: assignment?.department?.name ?? '',
          negativeDays: remaining,
          limit: negativeBalanceLimit,
        })
      }
    }

    const employeeCount = employeeRemainingMap.size
    const usageRate = totalGranted > 0 ? Math.round((totalUsed / totalGranted) * 1000) / 10 : 0
    const avgRemainingDays = employeeCount > 0 ? Math.round((totalRemaining / employeeCount) * 10) / 10 : 0

    // ── 5. Pending leave count ────────────────────────────

    const pendingCount = await prisma.leaveRequest.count({
      where: {
        companyId,
        status: 'PENDING',
        createdAt: {
          gte: new Date(year, 0, 1),
          lte: new Date(year, 11, 31, 23, 59, 59, 999),
        },
      },
    })

    // ── 6. Department usage breakdown ─────────────────────

    const deptUsageMap = new Map<string, { name: string; granted: number; used: number; headcount: number }>()

    for (const b of balances) {
      const emp = empMap.get(b.employeeId)
      const assignment = extractPrimaryAssignment(emp?.assignments ?? [])
      const deptId = assignment?.departmentId ?? 'unknown'
      const deptName = assignment?.department?.name ?? '미지정'

      const existing = deptUsageMap.get(deptId) ?? { name: deptName, granted: 0, used: 0, headcount: 0 }
      existing.granted += Number(b.grantedDays) + Number(b.carryOverDays)
      existing.used += Number(b.usedDays)
      deptUsageMap.set(deptId, existing)
    }

    // Count unique employees per department
    const deptEmployees = new Map<string, Set<string>>()
    for (const emp of employees) {
      const assignment = extractPrimaryAssignment(emp.assignments)
      const deptId = assignment?.departmentId ?? 'unknown'
      if (!deptEmployees.has(deptId)) deptEmployees.set(deptId, new Set())
      deptEmployees.get(deptId)!.add(emp.id)
    }

    const usageByDepartment = Array.from(deptUsageMap.entries())
      .map(([deptId, d]) => ({
        department: d.name,
        usageRate: d.granted > 0 ? Math.round((d.used / d.granted) * 1000) / 10 : 0,
        headcount: deptEmployees.get(deptId)?.size ?? 0,
        totalGranted: Math.round(d.granted * 10) / 10,
        totalUsed: Math.round(d.used * 10) / 10,
      }))
      .sort((a, b) => b.usageRate - a.usageRate)

    // ── 7. Remaining days distribution (histogram) ────────

    const ranges = [
      { label: '0일 이하', min: -Infinity, max: 0 },
      { label: '1-3일', min: 0.01, max: 3 },
      { label: '4-7일', min: 3.01, max: 7 },
      { label: '8-11일', min: 7.01, max: 11 },
      { label: '12-15일', min: 11.01, max: 15 },
      { label: '15일 초과', min: 15.01, max: Infinity },
    ]

    const remainingDistribution = ranges.map((r) => ({
      range: r.label,
      count: Array.from(employeeRemainingMap.values()).filter(
        (rem) => rem >= r.min && rem <= r.max,
      ).length,
    }))

    // ── 8. Burn-down forecast (monthly) ───────────────────

    const yearStart = new Date(year, 0, 1)
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999)

    const monthlyRequests = await prisma.leaveRequest.findMany({
      where: {
        companyId,
        status: { in: ['APPROVED', 'PENDING'] },
        startDate: { gte: yearStart, lte: yearEnd },
      },
      select: {
        startDate: true,
        days: true,
      },
    })

    // Group by month
    const monthlyUsed = new Array(12).fill(0) as number[]
    for (const r of monthlyRequests) {
      const month = new Date(r.startDate).getMonth()
      monthlyUsed[month] += Number(r.days)
    }

    const currentMonth = new Date().getMonth()
    const pastMonths = monthlyUsed.slice(0, currentMonth + 1)
    const avgMonthlyRate = pastMonths.length > 0
      ? pastMonths.reduce((sum, v) => sum + v, 0) / pastMonths.length
      : 0

    const burndownForecast = []
    let cumulative = 0

    for (let m = 0; m < 12; m++) {
      if (m <= currentMonth) {
        cumulative += monthlyUsed[m]
        burndownForecast.push({
          month: `${year}-${String(m + 1).padStart(2, '0')}`,
          actual: Math.round(cumulative * 10) / 10,
          projected: Math.round(cumulative * 10) / 10,
        })
      } else {
        cumulative += avgMonthlyRate
        burndownForecast.push({
          month: `${year}-${String(m + 1).padStart(2, '0')}`,
          actual: null,
          projected: Math.round(cumulative * 10) / 10,
        })
      }
    }

    const projectedYearEndUsage = cumulative
    const yearEndUsageRate = totalGranted > 0
      ? Math.round((projectedYearEndUsage / totalGranted) * 1000) / 10
      : 0
    const yearEndUnusedRate = Math.max(0, 100 - yearEndUsageRate)

    // ── 8. Response ──────────────────────────────────────

    return apiSuccess({
      year,
      kpi: {
        usageRate,
        avgRemainingDays,
        negativeCount,
        negativeTotalDays: Math.round(negativeTotalDays * 10) / 10,
        pendingCount,
        employeeCount,
        totalGranted: Math.round(totalGranted * 10) / 10,
        totalUsed: Math.round(totalUsed * 10) / 10,
      },
      usageByDepartment,
      remainingDistribution,
      burndownForecast,
      yearEndProjection: {
        usageRate: yearEndUsageRate,
        unusedRate: yearEndUnusedRate,
      },
      negativeBalanceEmployees: negativeEmployees,
    })
  },
  perm(MODULE.LEAVE, ACTION.APPROVE),
)
