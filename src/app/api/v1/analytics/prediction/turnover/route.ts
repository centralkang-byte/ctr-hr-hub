// ═══════════════════════════════════════════════════════════
// G-2: Turnover Prediction API
// GET /api/v1/analytics/prediction/turnover
// Batch queries — no N+1 per employee
// 🚨 CRITICAL: status ACTIVE filter to avoid scoring ex-employees
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { calculateTurnoverRisk } from '@/lib/analytics/turnover-prediction'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _ctx, _user: SessionUser) => {
    try {
      const searchParams = new URL(req.url).searchParams
      const companyId = searchParams.get('companyId') || undefined
      const departmentId = searchParams.get('departmentId') || undefined
      const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
      const now = new Date()
      const currentYear = now.getFullYear()
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())

      // 1. Batch-fetch all ACTIVE employees
      const activeEmployees = await prisma.employeeAssignment.findMany({
        where: {
          status: 'ACTIVE',
          isPrimary: true,
          endDate: null,
          ...(companyId ? { companyId } : {}),
          ...(departmentId ? { departmentId } : {}),
        },
        include: {
          employee: {
            select: { id: true, name: true, hireDate: true },
          },
          department: { select: { name: true } },
          position: { select: { titleKo: true } },
          jobGrade: { select: { name: true } },
        },
      })

      const empIds = activeEmployees.map((a) => a.employeeId)

      if (empIds.length === 0) {
        return apiSuccess({
          data: [],
          summary: { totalAnalyzed: 0, highRisk: 0, mediumRisk: 0, lowRisk: 0 },
        })
      }

      // 2. Batch-fetch latest compensation with compa_ratio
      const compensations = await prisma.compensationHistory.findMany({
        where: { employeeId: { in: empIds } },
        orderBy: { effectiveDate: 'desc' },
        select: { employeeId: true, compaRatio: true },
      })
      const compaByEmp = new Map<string, number | null>()
      for (const c of compensations) {
        if (!compaByEmp.has(c.employeeId)) {
          compaByEmp.set(c.employeeId, c.compaRatio ? Number(c.compaRatio) : null)
        }
      }

      // 3. Batch-fetch last 2 performance reviews per employee
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

      // 4. Batch-fetch 3-month attendance overtime aggregates
      const attendances = await prisma.attendance.findMany({
        where: {
          employeeId: { in: empIds },
          workDate: { gte: threeMonthsAgo },
          overtimeMinutes: { gt: 0 },
        },
        select: { employeeId: true, overtimeMinutes: true },
      })
      const overtimeByEmp = new Map<string, number[]>()
      for (const a of attendances) {
        if (!overtimeByEmp.has(a.employeeId)) overtimeByEmp.set(a.employeeId, [])
        overtimeByEmp.get(a.employeeId)!.push(a.overtimeMinutes || 0)
      }

      // 5. Batch-fetch leave balances (current year)
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

      // 6. Batch-fetch assignment history (last 12 months) for manager changes
      const assignmentHistory = await prisma.employeeAssignment.findMany({
        where: {
          employeeId: { in: empIds },
          effectiveDate: { gte: oneYearAgo },
          changeType: { in: ['TRANSFER', 'REORGANIZATION'] },
        },
        select: { employeeId: true },
      })
      const managerChangesByEmp = new Map<string, number>()
      for (const a of assignmentHistory) {
        managerChangesByEmp.set(a.employeeId, (managerChangesByEmp.get(a.employeeId) || 0) + 1)
      }

      // 7. Assemble in-memory and calculate scores
      const results = activeEmployees.map((ae) => {
        const empId = ae.employeeId
        const emp = ae.employee

        // Overtime: convert total minutes to weekly avg hours
        const otMinutes = overtimeByEmp.get(empId) || []
        const totalOtMinutes = otMinutes.reduce((s, m) => s + m, 0)
        const weeksInRange = Math.max(1, Math.round(
          (now.getTime() - threeMonthsAgo.getTime()) / (7 * 24 * 60 * 60 * 1000)
        ))
        const avgWeeklyOvertime = (totalOtMinutes / 60) / weeksInRange

        // Leave usage rate
        const leave = leaveByEmp.get(empId)
        const leaveUsageRate = leave && leave.granted > 0 ? leave.used / leave.granted : 0

        // Tenure years
        const tenureYears = (now.getTime() - new Date(emp.hireDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)

        // Same position years (current assignment duration)
        const samePositionYears = (now.getTime() - new Date(ae.effectiveDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)

        // Reviews
        const empReviews = reviewsByEmp.get(empId) || []

        const riskResult = calculateTurnoverRisk({
          compaRatio: compaByEmp.get(empId) ?? null,
          lastGrade: empReviews[0] ?? null,
          prevGrade: empReviews[1] ?? null,
          avgWeeklyOvertime,
          leaveUsageRate,
          tenureYears,
          managerChanges: managerChangesByEmp.get(empId) || 0,
          samePositionYears,
        })

        return {
          employeeId: empId,
          name: emp.name,
          department: ae.department?.name || '미지정',
          position: ae.position?.titleKo || '-',
          jobGrade: ae.jobGrade?.name || '-',
          score: riskResult.score,
          level: riskResult.level,
          factors: riskResult.factors,
        }
      })

      // Sort by score desc and limit
      results.sort((a, b) => b.score - a.score)

      const summary = {
        totalAnalyzed: results.length,
        highRisk: results.filter((r) => r.level === 'HIGH').length,
        mediumRisk: results.filter((r) => r.level === 'MEDIUM').length,
        lowRisk: results.filter((r) => r.level === 'LOW').length,
      }

      return apiSuccess({
        data: limit > 0 ? results.slice(0, limit) : results,
        summary,
      })
    } catch (error) {
      return apiError(error)
    }
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
