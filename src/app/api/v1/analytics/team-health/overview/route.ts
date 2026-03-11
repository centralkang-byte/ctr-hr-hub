// ═══════════════════════════════════════════════════════════
// G-1: Team Health Overview API
// GET /api/v1/analytics/team-health/overview
// Manager-only: uses Position.reportsToPositionId for direct reports
// Empty state guard for 0 team members
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { TeamHealthResponse } from '@/lib/analytics/types'
import type { SessionUser } from '@/types'

function getScoreLevel(score: number): 'HEALTHY' | 'CAUTION' | 'WARNING' | 'CRITICAL' {
  if (score >= 80) return 'HEALTHY'
  if (score >= 60) return 'CAUTION'
  if (score >= 40) return 'WARNING'
  return 'CRITICAL'
}

function getSubLevel(score: number): string {
  if (score >= 80) return 'GOOD'
  if (score >= 60) return 'CAUTION'
  if (score >= 40) return 'WARNING'
  return 'CRITICAL'
}

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const userId = user.employeeId

    // Find manager's position
    const managerAssignment = await prisma.employeeAssignment.findFirst({
      where: { employeeId: userId, isPrimary: true, endDate: null, status: 'ACTIVE' },
      select: { positionId: true, companyId: true },
    })

    if (!managerAssignment?.positionId) {
      return apiSuccess<TeamHealthResponse>({
        isEmpty: true, score: 0, scoreLevel: 'HEALTHY',
        subScores: {
          overtime: { score: 0, level: 'GOOD' },
          leaveUsage: { score: 0, level: 'GOOD' },
          performanceDist: { score: 0, level: 'GOOD' },
          turnoverRisk: { score: 0, level: 'GOOD' },
          burnoutRisk: { score: 0, level: 'GOOD' },
        },
        members: [], recommendations: [],
      })
    }

    // Find direct reports via Position hierarchy
    const directReportPositions = await prisma.position.findMany({
      where: { reportsToPositionId: managerAssignment.positionId },
      select: { id: true },
    })

    const positionIds = directReportPositions.map((p) => p.id)

    // Find employees in those positions
    const memberAssignments = await prisma.employeeAssignment.findMany({
      where: {
        positionId: { in: positionIds },
        isPrimary: true, endDate: null, status: 'ACTIVE',
      },
      select: {
        employeeId: true,
        employee: { select: { id: true, name: true, attritionRiskScore: true } },
      },
    })

    // ── Empty State Guard ──
    if (memberAssignments.length === 0) {
      return apiSuccess<TeamHealthResponse>({
        isEmpty: true, score: 0, scoreLevel: 'HEALTHY',
        subScores: {
          overtime: { score: 0, level: 'GOOD' },
          leaveUsage: { score: 0, level: 'GOOD' },
          performanceDist: { score: 0, level: 'GOOD' },
          turnoverRisk: { score: 0, level: 'GOOD' },
          burnoutRisk: { score: 0, level: 'GOOD' },
        },
        members: [], recommendations: [],
      })
    }

    const memberIds = memberAssignments.map((m) => m.employeeId)
    const now = new Date()
    const currentYear = now.getFullYear()
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())

    // Fetch member data in parallel
    const [attendances, leaveBalances, latestReviews] = await Promise.all([
      prisma.attendance.findMany({
        where: { employeeId: { in: memberIds }, workDate: { gte: oneMonthAgo } },
        select: { employeeId: true, overtimeMinutes: true, totalMinutes: true },
      }),
      prisma.employeeLeaveBalance.findMany({
        where: { employeeId: { in: memberIds }, year: currentYear },
        select: { employeeId: true, grantedDays: true, usedDays: true },
      }),
      prisma.performanceReview.findMany({
        where: { employeeId: { in: memberIds } },
        orderBy: { cycle: { year: 'desc' } },
        select: { employeeId: true, finalGrade: true },
      }),
    ])

    // Aggregate per member
    const overtimeByEmp = new Map<string, number>()
    for (const a of attendances) {
      const current = overtimeByEmp.get(a.employeeId) || 0
      overtimeByEmp.set(a.employeeId, current + (a.overtimeMinutes || 0))
    }

    const leaveByEmp = new Map<string, { granted: number; used: number }>()
    for (const b of leaveBalances) {
      const curr = leaveByEmp.get(b.employeeId) || { granted: 0, used: 0 }
      curr.granted += Number(b.grantedDays)
      curr.used += Number(b.usedDays)
      leaveByEmp.set(b.employeeId, curr)
    }

    const gradeByEmp = new Map<string, string>()
    for (const r of latestReviews) {
      if (!gradeByEmp.has(r.employeeId) && r.finalGrade) {
        gradeByEmp.set(r.employeeId, r.finalGrade)
      }
    }

    const members: TeamHealthResponse['members'] = memberAssignments.map((ma) => {
      const emp = ma.employee
      const weeklyOvertimeMin = overtimeByEmp.get(ma.employeeId) || 0
      const weeklyOvertime = Math.round((weeklyOvertimeMin / 60) * 10) / 10

      const leave = leaveByEmp.get(ma.employeeId)
      const leaveUsageRate = leave && leave.granted > 0
        ? Math.round((leave.used / leave.granted) * 100) : 0

      const grade = gradeByEmp.get(ma.employeeId) || '-'

      // G-2: Enhanced risk calculation using actual data
      let riskPoints = 0
      if (weeklyOvertime > 10) riskPoints += 30
      else if (weeklyOvertime > 5) riskPoints += 15
      if (leaveUsageRate < 20) riskPoints += 20
      if (grade === 'B') riskPoints += 25
      const attritionBase = emp.attritionRiskScore || 0
      riskPoints = Math.max(riskPoints, attritionBase)
      const turnoverRisk: 'HIGH' | 'MEDIUM' | 'LOW' = riskPoints >= 70 ? 'HIGH' : riskPoints >= 40 ? 'MEDIUM' : 'LOW'

      // Overall status
      let redFlags = 0
      let yellowFlags = 0
      if (weeklyOvertime > 10) redFlags++
      else if (weeklyOvertime > 5) yellowFlags++
      if (leaveUsageRate < 20) yellowFlags++
      if (turnoverRisk === 'HIGH') redFlags++
      else if (turnoverRisk === 'MEDIUM') yellowFlags++
      if (grade === 'B') yellowFlags++
      // G-2: Burnout compound flag
      if (weeklyOvertime > 8 && leaveUsageRate < 30) redFlags++

      const overallStatus: 'GREEN' | 'YELLOW' | 'RED' = redFlags > 0 ? 'RED' : yellowFlags >= 2 ? 'YELLOW' : 'GREEN'

      return {
        employeeId: ma.employeeId,
        name: emp.name,
        weeklyOvertime,
        leaveUsageRate,
        lastGrade: grade,
        turnoverRisk,
        overallStatus,
      }
    })

    // ── Score Calculation (5 weighted indicators) ──
    const avg = (nums: number[]) => nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length

    // 1. Overtime (20%)
    const avgOvertime = avg(members.map((m) => m.weeklyOvertime))
    const overtimeScore = Math.max(0, Math.round(100 - (avgOvertime / 10) * 100))

    // 2. Leave Usage (15%)
    const avgLeaveUsage = avg(members.map((m) => m.leaveUsageRate))
    const leaveScore = Math.min(100, Math.round((avgLeaveUsage / 80) * 100))

    // 3. Performance Distribution (20%)
    const gradeValues = members.filter((m) => m.lastGrade !== '-').length
    const perfScore = gradeValues > 0 ? 70 : 50 // simplified

    // 4. Turnover Risk (25%)
    const highRiskPct = members.filter((m) => m.turnoverRisk === 'HIGH').length / members.length
    const turnoverScore = Math.max(0, Math.round(100 - (highRiskPct / 0.3) * 100))

    // 5. Burnout Risk (20%)
    const burnoutMembers = members.filter((m) => m.weeklyOvertime > 8 && m.leaveUsageRate < 30)
    const burnoutPct = burnoutMembers.length / members.length
    const burnoutScore = Math.max(0, Math.round(100 - (burnoutPct / 0.2) * 100))

    const totalScore = Math.round(
      overtimeScore * 0.20 +
      leaveScore * 0.15 +
      perfScore * 0.20 +
      turnoverScore * 0.25 +
      burnoutScore * 0.20,
    )

    // ── Recommendations ──
    const recommendations: TeamHealthResponse['recommendations'] = []
    for (const m of members) {
      if (m.overallStatus === 'RED') {
        const factors: string[] = []
        if (m.weeklyOvertime > 10) factors.push('과도한 초과근무')
        if (m.turnoverRisk === 'HIGH') factors.push('이직 고위험')
        if (m.leaveUsageRate < 20) factors.push('낮은 연차 사용')
        // G-2: Burnout compound detection
        if (m.weeklyOvertime > 8 && m.leaveUsageRate < 30) {
          factors.push('번아웃 위험 — 과로 + 미사용 복합')
          recommendations.push({
            severity: 'RED', employeeName: m.name, factors,
            actionText: '번아웃 위험 — 업무량 조정 및 1:1 면담을 즉시 진행하세요.',
            actionLink: `/employees/${m.employeeId}`,
          })
        } else {
          recommendations.push({
            severity: 'RED', employeeName: m.name, factors,
            actionText: '1:1 면담을 통해 업무 부하와 만족도를 확인하세요.',
            actionLink: `/employees/${m.employeeId}`,
          })
        }
      } else if (m.overallStatus === 'YELLOW') {
        const factors: string[] = []
        if (m.weeklyOvertime > 5) factors.push('초과근무 증가 추세')
        if (m.turnoverRisk === 'MEDIUM') factors.push('이직 주의')
        if (m.lastGrade === 'B') factors.push('성과 미흡')
        recommendations.push({
          severity: 'YELLOW', employeeName: m.name, factors,
          actionText: '업무량과 목표를 조정하고 모니터링하세요.',
        })
      }
    }

    if (recommendations.length === 0 && members.length > 0) {
      recommendations.push({
        severity: 'YELLOW', employeeName: '전체 팀',
        factors: ['건강한 상태'], actionText: '팀이 건강한 상태입니다 🎉',
      })
    }

    const response: TeamHealthResponse = {
      isEmpty: false,
      score: totalScore,
      scoreLevel: getScoreLevel(totalScore),
      subScores: {
        overtime: { score: overtimeScore, level: getSubLevel(overtimeScore) },
        leaveUsage: { score: leaveScore, level: getSubLevel(leaveScore) },
        performanceDist: { score: perfScore, level: getSubLevel(perfScore) },
        turnoverRisk: { score: turnoverScore, level: getSubLevel(turnoverScore) },
        burnoutRisk: { score: burnoutScore, level: getSubLevel(burnoutScore) },
      },
      members: members.sort((a, b) => {
        const order = { RED: 0, YELLOW: 1, GREEN: 2 }
        return order[a.overallStatus] - order[b.overallStatus]
      }),
      recommendations: recommendations.sort((a, b) => (a.severity === 'RED' ? -1 : 1)),
    }

    return apiSuccess(response)
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
