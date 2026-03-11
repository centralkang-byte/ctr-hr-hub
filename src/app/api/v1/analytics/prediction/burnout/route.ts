// ═══════════════════════════════════════════════════════════
// G-2: Burnout Detection API
// GET /api/v1/analytics/prediction/burnout
// Batch queries — no N+1 per employee
// 🚨 CRITICAL: status ACTIVE filter
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { detectBurnout } from '@/lib/analytics/burnout-detection'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _ctx, _user: SessionUser) => {
    try {
      const searchParams = new URL(req.url).searchParams
      const companyId = searchParams.get('companyId') || undefined
      const departmentId = searchParams.get('departmentId') || undefined
      const now = new Date()
      const currentYear = now.getFullYear()
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())

      // 1. All ACTIVE employees
      const activeEmployees = await prisma.employeeAssignment.findMany({
        where: {
          status: 'ACTIVE',
          isPrimary: true,
          endDate: null,
          ...(companyId ? { companyId } : {}),
          ...(departmentId ? { departmentId } : {}),
        },
        select: {
          employeeId: true,
          employee: { select: { id: true, name: true } },
          department: { select: { name: true } },
        },
      })

      const empIds = activeEmployees.map((a) => a.employeeId)

      if (empIds.length === 0) {
        return apiSuccess({
          data: [],
          summary: {
            totalAnalyzed: 0, atRisk: 0,
            byCondition: { overtime: 0, leaveUnused: 0, performanceDecline: 0 },
          },
        })
      }

      // 2. Batch-fetch 3-month attendance for overtime history per week
      const attendances = await prisma.attendance.findMany({
        where: {
          employeeId: { in: empIds },
          workDate: { gte: threeMonthsAgo },
        },
        select: { employeeId: true, workDate: true, overtimeMinutes: true },
        orderBy: { workDate: 'asc' },
      })

      // Build weekly overtime by employee
      const weeklyOvertimeByEmp = new Map<string, number[]>()
      const empWeekMap = new Map<string, Map<string, number>>()

      for (const a of attendances) {
        if (!empWeekMap.has(a.employeeId)) empWeekMap.set(a.employeeId, new Map())
        const weekStart = getWeekStart(new Date(a.workDate))
        const weekKey = weekStart.toISOString().slice(0, 10)
        const weekMap = empWeekMap.get(a.employeeId)!
        weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + (a.overtimeMinutes || 0))
      }

      for (const [empId, weekMap] of empWeekMap) {
        const weeks = Array.from(weekMap.values()).map((m) => m / 60) // minutes to hours
        weeklyOvertimeByEmp.set(empId, weeks)
      }

      // 3. Batch-fetch leave balances
      const leaveBalances = await prisma.employeeLeaveBalance.findMany({
        where: { employeeId: { in: empIds }, year: currentYear },
        select: { employeeId: true, grantedDays: true, usedDays: true },
      })
      const leaveByEmp = new Map<string, { granted: number; used: number }>()
      for (const b of leaveBalances) {
        const curr = leaveByEmp.get(b.employeeId) || { granted: 0, used: 0 }
        curr.granted += Number(b.grantedDays)
        curr.used += Number(b.usedDays)
        leaveByEmp.set(b.employeeId, curr)
      }

      // 4. Batch-fetch last 2 performance reviews
      const reviews = await prisma.performanceReview.findMany({
        where: { employeeId: { in: empIds }, finalGrade: { not: null } },
        orderBy: { cycle: { year: 'desc' } },
        select: { employeeId: true, finalGrade: true },
      })
      const reviewsByEmp = new Map<string, string[]>()
      for (const r of reviews) {
        const existing = reviewsByEmp.get(r.employeeId) || []
        if (existing.length < 2 && r.finalGrade) {
          existing.push(r.finalGrade)
          reviewsByEmp.set(r.employeeId, existing)
        }
      }

      // 5. Calculate burnout per employee
      let overtimeCount = 0
      let leaveUnusedCount = 0
      let perfDeclineCount = 0

      const results = activeEmployees.map((ae) => {
        const empId = ae.employeeId
        const leave = leaveByEmp.get(empId)
        const leaveUsageRate = leave && leave.granted > 0 ? leave.used / leave.granted : 0
        const empReviews = reviewsByEmp.get(empId) || []

        const burnoutResult = detectBurnout({
          weeklyOvertimeHistory: weeklyOvertimeByEmp.get(empId) || [],
          leaveUsageRate,
          lastGrade: empReviews[0] ?? null,
          prevGrade: empReviews[1] ?? null,
        })

        // Condition counting for summary
        for (const c of burnoutResult.triggeredConditions) {
          if (c.includes('초과근무')) overtimeCount++
          if (c.includes('연차')) leaveUnusedCount++
          if (c.includes('성과 하락')) perfDeclineCount++
        }

        return {
          employeeId: empId,
          name: ae.employee.name,
          department: ae.department?.name || '미지정',
          isAtRisk: burnoutResult.isAtRisk,
          conditionsMet: burnoutResult.conditionsMet,
          triggeredConditions: burnoutResult.triggeredConditions,
        }
      })

      // Filter to at-risk or return all with flag
      const atRiskResults = results.filter((r) => r.isAtRisk)

      return apiSuccess({
        data: atRiskResults.sort((a, b) => b.conditionsMet - a.conditionsMet),
        summary: {
          totalAnalyzed: results.length,
          atRisk: atRiskResults.length,
          byCondition: {
            overtime: overtimeCount,
            leaveUnused: leaveUnusedCount,
            performanceDecline: perfDeclineCount,
          },
        },
      })
    } catch (error) {
      return apiError(error)
    }
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)) // Monday start
  d.setHours(0, 0, 0, 0)
  return d
}
