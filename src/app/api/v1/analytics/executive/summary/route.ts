// ═══════════════════════════════════════════════════════════
// G-1: Executive Summary API 
// GET /api/v1/analytics/executive/summary
// Promise.all for 6 domains — KPIs, Charts, Risk Alerts, Company Comparison
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { parseAnalyticsParams, generateMonthRange, toYearMonth } from '@/lib/analytics/parse-params'
import { convertToKRW, formatCurrency } from '@/lib/analytics/currency'
import type { ExecutiveSummaryResponse } from '@/lib/analytics/types'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _ctx, _user: SessionUser) => {
    const params = parseAnalyticsParams(new URL(req.url).searchParams)
    const companyFilter = params.companyId ? { companyId: params.companyId } : {}
    const now = new Date()
//     const currentYear = now.getFullYear()

    // ── Promise.all: 6 domain queries ─────────────────────
    const [
      activeEmployees,
      companies,
      recentExits,
      prevExits,
      payrollRuns,
      openPostings,
      onboardings,
      hireTrend,
    ] = await Promise.all([
      // 1. Total active employees
      prisma.employeeAssignment.findMany({
        where: { ...companyFilter, status: 'ACTIVE', isPrimary: true, endDate: null },
        select: { employeeId: true, companyId: true, employee: { select: { hireDate: true } } },
      }),
      // 2. All companies (for comparison)
      prisma.company.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, currency: true },
      }),
      // 3. Recent exits (current month)
      prisma.employeeAssignment.count({
        where: {
          ...companyFilter,
          status: { in: ['RESIGNED', 'TERMINATED'] },
          isPrimary: true,
          endDate: { gte: new Date(now.getFullYear(), now.getMonth(), 1), lte: now },
        },
      }),
      // 4. Previous month exits
      prisma.employeeAssignment.count({
        where: {
          ...companyFilter,
          status: { in: ['RESIGNED', 'TERMINATED'] },
          isPrimary: true,
          endDate: {
            gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            lt: new Date(now.getFullYear(), now.getMonth(), 1),
          },
        },
      }),
      // 5. Latest payroll runs
      prisma.payrollRun.findMany({
        where: {
          ...companyFilter,
          status: { in: ['APPROVED', 'PAID'] },
        },
        orderBy: { yearMonth: 'desc' },
        take: 50,
        select: { companyId: true, totalGross: true, currency: true, yearMonth: true, headcount: true },
      }),
      // 6. Open job postings
      prisma.jobPosting.count({ where: { ...companyFilter, status: 'OPEN' } }),
      // 7. Active onboardings
      prisma.employeeOnboarding.findMany({
        where: { ...companyFilter, status: { in: ['NOT_STARTED', 'IN_PROGRESS'] } },
        select: { status: true },
      }),
      // 8. Monthly hire trend (TTM)
      prisma.employeeAssignment.findMany({
        where: {
          ...companyFilter,
          isPrimary: true,
          changeType: 'HIRE',
          effectiveDate: { gte: params.startDate, lte: params.endDate },
        },
        select: { effectiveDate: true },
      }),
    ])

    const totalEmps = activeEmployees.length

    // ── KPI: Avg tenure ──
    const tenures = activeEmployees.map((e) => {
      const hDate = e.employee?.hireDate
      if (!hDate) return 0
      return (now.getTime() - new Date(hDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    })
    const avgTenure = tenures.length > 0 ? tenures.reduce((a, b) => a + b, 0) / tenures.length : 0

    // ── KPI: Monthly turnover rate ──
    const monthlyTurnoverRate = totalEmps > 0 ? Math.round((recentExits / totalEmps) * 1000) / 10 : 0
    const prevTurnoverRate = totalEmps > 0 ? Math.round((prevExits / totalEmps) * 1000) / 10 : 0

    // ── KPI: Monthly labor cost (KRW) ──
    const latestMonth = payrollRuns[0]?.yearMonth
    const latestPayrolls = payrollRuns.filter((p) => p.yearMonth === latestMonth)
    let totalLaborCostKRW = 0
    for (const p of latestPayrolls) {
      totalLaborCostKRW += convertToKRW(Number(p.totalGross || 0), p.currency)
    }

    // Get previous month payroll for comparison
    const prevMonths = [...new Set(payrollRuns.map((p) => p.yearMonth))].sort().reverse()
    const prevMonth = prevMonths[1]
    const prevPayrolls = prevMonth ? payrollRuns.filter((p) => p.yearMonth === prevMonth) : []
    let prevLaborCostKRW = 0
    for (const p of prevPayrolls) {
      prevLaborCostKRW += convertToKRW(Number(p.totalGross || 0), p.currency)
    }
    const laborCostChange = prevLaborCostKRW > 0
      ? Math.round(((totalLaborCostKRW - prevLaborCostKRW) / prevLaborCostKRW) * 1000) / 10
      : 0

    // ── KPI: Onboarding completion ──
    const completedOnb = await prisma.employeeOnboarding.count({
      where: { ...companyFilter, status: 'COMPLETED', completedAt: { gte: params.startDate } },
    })
    const totalOnb = onboardings.length + completedOnb
    const onbRate = totalOnb > 0 ? Math.round((completedOnb / totalOnb) * 1000) / 10 : 0

    // ── Chart: Headcount trend ──
    const months = generateMonthRange(params.startDate, params.endDate)
    const monthlyHires = new Map<string, number>()
    for (const h of hireTrend) {
      const m = toYearMonth(new Date(h.effectiveDate))
      monthlyHires.set(m, (monthlyHires.get(m) || 0) + 1)
    }

    // Get monthly exits
    const exitAssignments = await prisma.employeeAssignment.findMany({
      where: {
        ...companyFilter,
        isPrimary: true,
        status: { in: ['RESIGNED', 'TERMINATED'] },
        endDate: { gte: params.startDate, lte: params.endDate },
      },
      select: { endDate: true },
    })
    const monthlyExits = new Map<string, number>()
    for (const e of exitAssignments) {
      if (e.endDate) {
        const m = toYearMonth(new Date(e.endDate))
        monthlyExits.set(m, (monthlyExits.get(m) || 0) + 1)
      }
    }

    const headcountTrend = months.map((m) => ({
      month: m,
      hires: monthlyHires.get(m) || 0,
      exits: monthlyExits.get(m) || 0,
      net: (monthlyHires.get(m) || 0) - (monthlyExits.get(m) || 0),
    }))

    // ── Chart: Turnover trend ──
    const turnoverTrend = months.map((m) => {
      const exits = monthlyExits.get(m) || 0
      const rate = totalEmps > 0 ? Math.round((exits / totalEmps) * 1000) / 10 : 0
      return { month: m, rate }
    })

    // ── Chart: Company distribution ──
    const companyCount = new Map<string, number>()
    for (const a of activeEmployees) {
      companyCount.set(a.companyId, (companyCount.get(a.companyId) || 0) + 1)
    }
    const companyMap = new Map(companies.map((c) => [c.id, c]))
    const companyDistribution = Array.from(companyCount.entries())
      .map(([cId, cnt]) => ({
        company: companyMap.get(cId)?.name || '알 수 없음',
        count: cnt,
        percentage: totalEmps > 0 ? Math.round((cnt / totalEmps) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count)

    // ── Risk Alerts (G-2: connected to prediction data) ──
    const riskAlerts: ExecutiveSummaryResponse['riskAlerts'] = []
    if (monthlyTurnoverRate > 5) {
      riskAlerts.push({ type: '높은 이직률', count: recentExits, severity: 'HIGH', link: '/analytics/turnover' })
    }
    const overtimeViolations = await prisma.attendance.count({
      where: {
        ...companyFilter,
        workDate: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        overtimeMinutes: { gt: 0 },
      },
    })
    if (overtimeViolations > 10) {
      riskAlerts.push({ type: '초과근무 다발', count: overtimeViolations, severity: 'MEDIUM', link: '/analytics/attendance' })
    }

    // G-2: Turnover prediction high-risk count
    const highRiskCount = await prisma.employee.count({
      where: { deletedAt: null, attritionRiskScore: { gte: 70 } },
    })
    if (highRiskCount > 0) {
      riskAlerts.push({
        type: '이직 예측 고위험',
        count: highRiskCount,
        severity: highRiskCount >= 10 ? 'HIGH' : highRiskCount >= 5 ? 'MEDIUM' : 'LOW',
        link: '/analytics/turnover',
      })
    }

    // G-2: Burnout risk indicator (overtime + low leave)
    const burnoutCandidates = activeEmployees.length > 0
      ? await prisma.attendance.groupBy({
          by: ['employeeId'],
          where: {
            employeeId: { in: activeEmployees.map((e) => e.employeeId) },
            workDate: { gte: new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()) },
          },
          _sum: { overtimeMinutes: true },
          having: { overtimeMinutes: { _sum: { gt: 2400 } } }, // ~10h/week × 12 weeks
        })
      : []
    if (burnoutCandidates.length >= 2) {
      riskAlerts.push({
        type: '번아웃 위험',
        count: burnoutCandidates.length,
        severity: burnoutCandidates.length >= 5 ? 'HIGH' : 'MEDIUM',
        link: '/analytics/team-health',
      })
    }

    // ── Company Comparison ──
    const companyComparison = companies.map((c) => {
      const headcount = companyCount.get(c.id) || 0
      const companyPayrolls = latestPayrolls.filter((p) => p.companyId === c.id)
      let laborCostOriginal = 0
      for (const p of companyPayrolls) laborCostOriginal += Number(p.totalGross || 0)
      const laborCostKRW = convertToKRW(laborCostOriginal, c.currency)

      const companyExits = exitAssignments.filter((e) => e.endDate).length // simplified
      const turnoverRate = headcount > 0 ? Math.round((companyExits / headcount) * 100) / 10 : 0

      const companyTenures = activeEmployees
        .filter((a) => a.companyId === c.id)
        .map((a) => {
          const hd = a.employee?.hireDate
          return hd ? (now.getTime() - new Date(hd).getTime()) / (365.25 * 24 * 60 * 60 * 1000) : 0
        })
      const avgCompanyTenure = companyTenures.length > 0 ? companyTenures.reduce((a, b) => a + b, 0) / companyTenures.length : 0

      return {
        companyId: c.id,
        companyName: c.name,
        headcount,
        turnoverRate,
        avgTenure: Math.round(avgCompanyTenure * 10) / 10,
        laborCost: formatCurrency(laborCostOriginal, c.currency),
        laborCostKRW,
        onboardingInProgress: 0, // simplified
      }
    }).filter((c) => c.headcount > 0)
      .sort((a, b) => b.headcount - a.headcount)

    // ── Response ──
    const response: ExecutiveSummaryResponse = {
      kpis: {
        totalEmployees: { label: '총 재직인원', value: totalEmps, unit: '명', severity: 'neutral' },
        monthlyTurnoverRate: {
          label: '월간 이직률', value: monthlyTurnoverRate, unit: '%',
          change: monthlyTurnoverRate - prevTurnoverRate,
          changeLabel: '전월 대비',
          severity: monthlyTurnoverRate > prevTurnoverRate ? 'negative' : 'positive',
        },
        avgTenureYears: { label: '평균 근속', value: Math.round(avgTenure * 10) / 10, unit: '년', severity: 'neutral' },
        monthlyLaborCost: {
          label: '월 인건비', value: formatCurrency(totalLaborCostKRW, 'KRW'), unit: '',
          change: laborCostChange, changeLabel: '전월 대비',
          severity: laborCostChange > 0 ? 'negative' : 'positive',
        },
        recruitmentPipeline: {
          label: '채용 진행', value: `공고 ${openPostings}건`, severity: 'neutral',
        },
        onboardingCompletionRate: {
          label: '온보딩 완료율', value: onbRate, unit: '%', severity: onbRate < 50 ? 'negative' : 'positive',
        },
      },
      charts: { headcountTrend, turnoverTrend, companyDistribution },
      riskAlerts,
      companyComparison,
    }

    return apiSuccess(response)
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
