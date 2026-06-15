// ═══════════════════════════════════════════════════════════
// G-1: Attendance Overview API
// GET /api/v1/analytics/attendance/overview
// Reuses F-3 leave stats for leave-related KPIs
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { parseAnalyticsParams, generateMonthRange, toYearMonth } from '@/lib/analytics/parse-params'
import type { AttendanceResponse } from '@/lib/analytics/types'
import type { SessionUser } from '@/types'
import { resolveCompanyFilter } from '@/lib/api/companyFilter'
import { annualBalanceWhere, leaveAvailable, leaveUtilizationRate } from '@/lib/leave/utilization'

// 멀티테넌트 격리: LeaveYearBalance 는 companyId 컬럼이 없어 employee 활성 primary 발령 관계로
// 법인 스코프 (글로벌 annual def 공유 → 이 employee 스코프가 테넌트 격리의 핵심). companyId=null → SUPER 통합뷰.
// 사용률 = annual-only · 분모 가용분(entitled+이월+조정) — SSOT @/lib/leave/utilization (PR2 레거시 퇴출).
function activeAssignmentWhere(companyId: string) {
  return { assignments: { some: { companyId, isPrimary: true, endDate: null, status: 'ACTIVE' } } }
}

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const params = parseAnalyticsParams(new URL(req.url).searchParams)
    const companyFilter = resolveCompanyFilter(user, params.companyId)
    const companyId = companyFilter.companyId ?? null
    const currentYear = new Date().getFullYear()

    const [attendanceRecords, leaveBalances] = await Promise.all([
      // Attendance with overtime
      prisma.attendance.findMany({
        where: {
          ...companyFilter,
          workDate: { gte: params.startDate, lte: params.endDate },
        },
        select: { workDate: true, overtimeMinutes: true, totalMinutes: true, clockIn: true },
      }),
      // Leave balances for usage rate — SSOT LeaveYearBalance · annual-only · 법인 스코프
      // (employee 활성발령 + annual def[자사+글로벌] 교차; 글로벌 def 공유라 employee 스코프 필수)
      prisma.leaveYearBalance.findMany({
        where: {
          year: currentYear,
          ...(companyId ? { employee: activeAssignmentWhere(companyId) } : {}),
          ...annualBalanceWhere(companyId),
        },
        select: { entitled: true, used: true, carriedOver: true, adjusted: true, employeeId: true },
      }),
    ])

    // KPI: Leave usage rate — 분모 가용분(entitled+이월+조정), annual-only
    const totalAvailable = leaveBalances.reduce((sum, b) => sum + leaveAvailable(b), 0)
    const totalUsed = leaveBalances.reduce((sum, b) => sum + b.used, 0)
    const usageRate = leaveUtilizationRate(totalUsed, totalAvailable)
    const leaveUsageRate = usageRate === null ? 0 : Math.round(usageRate * 1000) / 10

    // KPI: Weekly overtime violations (52h = 3120 min)
    // Group by employee+week and check violations
    const weeklyEmployee = new Map<string, number>()
    for (const a of attendanceRecords) {
      const d = new Date(a.workDate)
      const weekNum = Math.floor(d.getTime() / (7 * 24 * 60 * 60 * 1000))
      const key = `${weekNum}`
      weeklyEmployee.set(key, (weeklyEmployee.get(key) || 0) + (a.totalMinutes || 0))
    }
    const violationCount = Array.from(weeklyEmployee.values()).filter((m) => m > 3120).length

    // KPI: Avg overtime hours
    const totalOvertimeMinutes = attendanceRecords.reduce((sum, a) => sum + (a.overtimeMinutes || 0), 0)
    const avgOvertimeHours = attendanceRecords.length > 0
      ? Math.round((totalOvertimeMinutes / attendanceRecords.length / 60) * 10) / 10 : 0

    // KPI: Negative balance count — 직원 단위 distinct (정책별 row 합산 후 used>granted).
    // KPI 단위가 '명'이므로 row 수가 아닌 직원 수. 위 법인-스코프 leaveBalances 재사용
    // (별도 unscoped raw SQL 제거 → cross-tenant 누출 차단).
    const balByEmp = new Map<string, { available: number; used: number }>()
    for (const b of leaveBalances) {
      const cur = balByEmp.get(b.employeeId) ?? { available: 0, used: 0 }
      cur.available += leaveAvailable(b)
      cur.used += b.used
      balByEmp.set(b.employeeId, cur)
    }
    let negBalCount = 0
    for (const v of balByEmp.values()) if (v.used > v.available) negBalCount++

    // Chart: Overtime trend
    const months = generateMonthRange(params.startDate, params.endDate)
    const monthlyOvertime = new Map<string, { total: number; count: number }>()
    for (const a of attendanceRecords) {
      const m = toYearMonth(new Date(a.workDate))
      const existing = monthlyOvertime.get(m) || { total: 0, count: 0 }
      existing.total += (a.overtimeMinutes || 0)
      existing.count++
      monthlyOvertime.set(m, existing)
    }
    const overtimeTrend = months.map((m) => {
      const d = monthlyOvertime.get(m)
      return { month: m, avgMinutes: d && d.count > 0 ? Math.round(d.total / d.count) : 0 }
    })

    // Chart: Violation trend (simplified monthly count)
    const monthlyViolations = new Map<string, number>()
    for (const a of attendanceRecords) {
      if ((a.overtimeMinutes || 0) > 180) { // simplified: daily >3h overtime as proxy
        const m = toYearMonth(new Date(a.workDate))
        monthlyViolations.set(m, (monthlyViolations.get(m) || 0) + 1)
      }
    }
    const violationTrend = months.map((m) => ({
      month: m,
      count: monthlyViolations.get(m) || 0,
    }))

    // Chart: Department leave usage (from F-3 approach)
    const departmentLeaveUsage: { department: string; usageRate: number }[] = []
    // Simplified — full dept breakdown requires joining with assignments

    // Chart: Weekday pattern
    const patternMap = new Map<string, number>()
    const dayNames = ['일', '월', '화', '수', '목', '금', '토']
    for (const a of attendanceRecords) {
      if (!a.clockIn) continue
      const d = new Date(a.clockIn)
      const day = dayNames[d.getDay()]
      const hour = d.getHours()
      const key = `${day}-${hour}`
      patternMap.set(key, (patternMap.get(key) || 0) + 1)
    }
    const weekdayPattern = Array.from(patternMap.entries()).map(([key, count]) => {
      const [day, hourStr] = key.split('-')
      return { day, hour: parseInt(hourStr), count }
    })

    const response: AttendanceResponse = {
      kpis: {
        leaveUsageRate: { label: '연차 사용률', value: leaveUsageRate, unit: '%', severity: leaveUsageRate > 80 ? 'positive' : 'neutral' },
        weeklyOvertimeViolations: { label: '52h 위반', value: violationCount, unit: '건', severity: violationCount > 0 ? 'negative' : 'positive' },
        avgOvertimeHours: { label: '평균 초과근무', value: avgOvertimeHours, unit: '시간', severity: avgOvertimeHours > 5 ? 'negative' : 'neutral' },
        negativeBalanceCount: { label: '마이너스 연차', value: negBalCount, unit: '명', severity: negBalCount > 0 ? 'negative' : 'neutral' },
      },
      charts: { overtimeTrend, violationTrend, departmentLeaveUsage, weekdayPattern },
    }

    return apiSuccess(response)
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
