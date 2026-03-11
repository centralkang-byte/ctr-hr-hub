// ═══════════════════════════════════════════════════════════
// G-1: Turnover Overview API
// GET /api/v1/analytics/turnover/overview
// Includes regrettable turnover (M+ exits) + 5-record privacy guard
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { parseAnalyticsParams, generateMonthRange, toYearMonth } from '@/lib/analytics/parse-params'
import type { TurnoverResponse } from '@/lib/analytics/types'
import type { SessionUser } from '@/types'

const BENCHMARK_RATE = 4.5 // Settings-connected: industry average benchmark rate (SYSTEM/benchmark-rates)

const EXIT_REASON_LABELS: Record<string, string> = {
  COMPENSATION: '보상/급여',
  CAREER_GROWTH: '성장/커리어',
  WORK_LIFE_BALANCE: '워라밸',
  MANAGEMENT: '관리/리더십',
  CULTURE: '조직문화',
  RELOCATION: '이전/통근',
  PERSONAL: '개인사유',
  OTHER: '기타',
}

export const GET = withPermission(
  async (req: NextRequest, _ctx, _user: SessionUser) => {
    const params = parseAnalyticsParams(new URL(req.url).searchParams)
    const companyFilter = params.companyId ? { companyId: params.companyId } : {}
    const now = new Date()
    const currentYear = now.getFullYear()

    // Use 24-month range for turnover trend
    const trendStart = new Date(now.getFullYear() - 2, now.getMonth(), 1)

    const [totalActive, exitAssignments, exitInterviews, highRiskCount, regrettableExits] = await Promise.all([
      prisma.employeeAssignment.count({
        where: { ...companyFilter, status: 'ACTIVE', isPrimary: true, endDate: null },
      }),
      // All exits in TTM (expanded range for trend)
      prisma.employeeAssignment.findMany({
        where: {
          ...companyFilter, isPrimary: true,
          status: { in: ['RESIGNED', 'TERMINATED'] },
          endDate: { gte: trendStart, lte: now },
        },
        select: {
          endDate: true,
          departmentId: true,
          employee: { select: { hireDate: true, id: true } },
          department: { select: { name: true } },
        },
      }),
      // Exit interviews (with 5-record privacy guard)
      prisma.exitInterview.findMany({
        where: companyFilter,
        select: {
          primaryReason: true, satisfactionScore: true, wouldRecommend: true,
          interviewDate: true, companyId: true,
          employeeOffboarding: {
            select: {
              employee: {
                select: {
                  assignments: {
                    where: { isPrimary: true },
                    take: 1,
                    select: { department: { select: { name: true } } },
                  },
                },
              },
            },
          },
        },
      }),
      // High risk prediction (placeholder count)
      prisma.employee.count({
        where: { deletedAt: null, attritionRiskScore: { gte: 70 } },
      }),
      // Regrettable turnover: M+ performers who left
      prisma.performanceReview.findMany({
        where: {
          ...companyFilter,
          finalGrade: { in: ['E', 'M_PLUS', 'M'] }, // M and above = regrettable
          employee: {
            assignments: {
              some: {
                isPrimary: true,
                status: { in: ['RESIGNED', 'TERMINATED'] },
                endDate: { gte: params.startDate, lte: params.endDate },
              },
            },
          },
        },
        select: { employeeId: true },
      }),
    ])

    const ttmExits = exitAssignments.filter(
      (e) => e.endDate && new Date(e.endDate) >= params.startDate,
    )

    // KPI: Monthly turnover rate (current month)
    const currentMonthExits = exitAssignments.filter((e) => {
      if (!e.endDate) return false
      const d = new Date(e.endDate)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
    const monthlyRate = totalActive > 0 ? Math.round((currentMonthExits / totalActive) * 1000) / 10 : 0

    // KPI: Annual cumulative
    const yearExits = exitAssignments.filter((e) => {
      if (!e.endDate) return false
      return new Date(e.endDate).getFullYear() === currentYear
    }).length
    const annualRate = totalActive > 0 ? Math.round((yearExits / totalActive) * 1000) / 10 : 0

    // KPI: Regrettable turnover rate
    const regrettableRate = ttmExits.length > 0
      ? Math.round((regrettableExits.length / ttmExits.length) * 1000) / 10 : 0

    // KPI: Avg tenure at exit
    const exitTenures = ttmExits
      .map((e) => {
        const hd = e.employee?.hireDate
        const ed = e.endDate
        if (!hd || !ed) return null
        return (new Date(ed).getTime() - new Date(hd).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      })
      .filter((t): t is number => t !== null)
    const avgTenureAtExit = exitTenures.length > 0
      ? Math.round(exitTenures.reduce((a, b) => a + b, 0) / exitTenures.length * 10) / 10 : 0

    // Chart: 24-month turnover trend
    const months24 = generateMonthRange(trendStart, now)
    const monthlyExitCounts = new Map<string, number>()
    for (const e of exitAssignments) {
      if (e.endDate) {
        const m = toYearMonth(new Date(e.endDate))
        monthlyExitCounts.set(m, (monthlyExitCounts.get(m) || 0) + 1)
      }
    }
    const turnoverTrend = months24.map((m) => ({
      month: m,
      rate: totalActive > 0 ? Math.round(((monthlyExitCounts.get(m) || 0) / totalActive) * 1000) / 10 : 0,
    }))

    // Chart: Exit reasons
    const reasonCounts = new Map<string, number>()
    for (const i of exitInterviews) {
      const label = EXIT_REASON_LABELS[i.primaryReason] || i.primaryReason
      reasonCounts.set(label, (reasonCounts.get(label) || 0) + 1)
    }
    const totalInterviews = exitInterviews.length
    const exitReasons = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({
        reason, count,
        percentage: totalInterviews > 0 ? Math.round((count / totalInterviews) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count)

    // Chart: Department turnover
    const deptExits = new Map<string, number>()
    for (const e of ttmExits) {
      const dept = e.department?.name || '미지정'
      deptExits.set(dept, (deptExits.get(dept) || 0) + 1)
    }
    const departmentTurnover = Array.from(deptExits.entries())
      .map(([department, count]) => ({
        department,
        rate: totalActive > 0 ? Math.round((count / totalActive) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.rate - a.rate)

    // Chart: Tenure at exit distribution
    const tenureBuckets = { '0-6개월': 0, '6개월-1년': 0, '1-2년': 0, '2-3년': 0, '3-5년': 0, '5년+': 0 }
    for (const t of exitTenures) {
      if (t < 0.5) tenureBuckets['0-6개월']++
      else if (t < 1) tenureBuckets['6개월-1년']++
      else if (t < 2) tenureBuckets['1-2년']++
      else if (t < 3) tenureBuckets['2-3년']++
      else if (t < 5) tenureBuckets['3-5년']++
      else tenureBuckets['5년+']++
    }
    const tenureAtExitDist = Object.entries(tenureBuckets).map(([range, count]) => ({ range, count }))

    // ── Exit Interview Stats (5-record privacy guard) ──
    const canDisplay = exitInterviews.length >= 5
    const satisfactionScores = exitInterviews.map((i) => i.satisfactionScore)
    const avgSatisfaction = satisfactionScores.length > 0
      ? Math.round(satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length * 10) / 10 : 0
    const wouldRecommendCount = exitInterviews.filter((i) => i.wouldRecommend === true).length
    const wouldRejoinRate = exitInterviews.length > 0
      ? Math.round((wouldRecommendCount / exitInterviews.length) * 1000) / 10 : 0

    // Check departments with insufficient data
    const deptInterviewCounts = new Map<string, number>()
    for (const i of exitInterviews) {
      const dept = i.employeeOffboarding?.employee?.assignments?.[0]?.department?.name || '미지정'
      deptInterviewCounts.set(dept, (deptInterviewCounts.get(dept) || 0) + 1)
    }
    const insufficientDepartments = Array.from(deptInterviewCounts.entries())
      .filter(([, cnt]) => cnt < 5)
      .map(([dept]) => dept)

    const response: TurnoverResponse = {
      kpis: {
        monthlyTurnoverRate: {
          label: '월간 이직률', value: monthlyRate, unit: '%',
          severity: monthlyRate > BENCHMARK_RATE ? 'negative' : 'positive',
        },
        annualCumulativeRate: { label: '연간 누적', value: annualRate, unit: '%', severity: annualRate > 15 ? 'negative' : 'neutral' },
        regrettableTurnoverRate: {
          label: '핵심 인재 이직률', value: regrettableRate, unit: '%',
          severity: regrettableRate > 5 ? 'negative' : 'neutral',
        },
        avgTenureAtExit: { label: '퇴사자 평균 재직', value: avgTenureAtExit, unit: '년', severity: 'neutral' },
        highRiskPrediction: { label: '이직 예측 고위험', value: highRiskCount, unit: '명', severity: highRiskCount > 5 ? 'negative' : 'neutral' },
      },
      charts: { turnoverTrend, exitReasons, departmentTurnover, tenureAtExitDist },
      exitInterviewStats: {
        canDisplay,
        totalCount: exitInterviews.length,
        ...(canDisplay && {
          reasonBreakdown: exitReasons.map((r) => ({ reason: r.reason, percentage: r.percentage })),
          satisfactionTrend: [{ period: `${currentYear}`, score: avgSatisfaction }],
          wouldRejoinRate,
        }),
        insufficientDepartments,
      },
      benchmarkRate: BENCHMARK_RATE,
    }

    return apiSuccess(response)
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
