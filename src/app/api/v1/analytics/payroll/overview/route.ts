// ═══════════════════════════════════════════════════════════
// G-1: Payroll Overview API
// GET /api/v1/analytics/payroll/overview
// Currency Trap: cross-company = KRW, single company = original
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { parseAnalyticsParams, generateMonthRange } from '@/lib/analytics/parse-params'
import { convertToKRW, formatCurrency } from '@/lib/analytics/currency'
import type { PayrollResponse } from '@/lib/analytics/types'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _ctx, _user: SessionUser) => {
    const params = parseAnalyticsParams(new URL(req.url).searchParams)
    const companyFilter = params.companyId ? { companyId: params.companyId } : {}
    const isCrossCompany = !params.companyId

    const [payrollRuns, anomalyCount, companies] = await Promise.all([
      prisma.payrollRun.findMany({
        where: {
          ...companyFilter,
          status: { in: ['APPROVED', 'PAID'] },
        },
        orderBy: { yearMonth: 'desc' },
        select: {
          companyId: true, yearMonth: true, totalGross: true, totalDeductions: true,
          totalNet: true, headcount: true, currency: true,
        },
      }),
      prisma.payrollAnomaly.count({
        where: {
          ...companyFilter,
          status: 'OPEN',
        },
      }),
      prisma.company.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true, name: true, currency: true },
      }),
    ])

    const companyMap = new Map(companies.map((c) => [c.id, c]))

    // Group by month
    const monthMap = new Map<string, { total: number; gross: number; deductions: number; headcount: number }>()
    for (const r of payrollRuns) {
      const gross = Number(r.totalGross || 0)
      const deductions = Number(r.totalDeductions || 0)
      const total = isCrossCompany ? convertToKRW(gross, r.currency) : gross
      const grossKRW = isCrossCompany ? convertToKRW(gross, r.currency) : gross
      const dedKRW = isCrossCompany ? convertToKRW(deductions, r.currency) : deductions

      const existing = monthMap.get(r.yearMonth) || { total: 0, gross: 0, deductions: 0, headcount: 0 }
      existing.total += total
      existing.gross += grossKRW
      existing.deductions += dedKRW
      existing.headcount += r.headcount
      monthMap.set(r.yearMonth, existing)
    }

    const months = generateMonthRange(params.startDate, params.endDate)
    const monthlyTrend = months.map((m) => {
      const d = monthMap.get(m)
      return {
        month: m,
        baseSalary: d?.gross || 0,
        allowances: 0, // simplified — PayrollItem level breakdown not available at run level
        total: d?.total || 0,
      }
    })

    // KPI: Latest month total
    const sortedMonths = Array.from(monthMap.entries()).sort((a, b) => b[0].localeCompare(a[0]))
    const latestData = sortedMonths[0]?.[1]
    const prevData = sortedMonths[1]?.[1]
    const latestTotal = latestData?.total || 0
    const prevTotal = prevData?.total || 0
    const changeRate = prevTotal > 0 ? Math.round(((latestTotal - prevTotal) / prevTotal) * 1000) / 10 : 0
    const perCapita = latestData && latestData.headcount > 0
      ? Math.round(latestTotal / latestData.headcount) : 0

    const displayCurrency = isCrossCompany ? 'KRW' : (companies.find((c) => c.id === params.companyId)?.currency || 'KRW')

    // Company comparison
    const companyTotals = new Map<string, { gross: number; currency: string }>()
    const latestYearMonth = sortedMonths[0]?.[0]
    for (const r of payrollRuns.filter((p) => p.yearMonth === latestYearMonth)) {
      const existing = companyTotals.get(r.companyId) || { gross: 0, currency: r.currency }
      existing.gross += Number(r.totalGross || 0)
      companyTotals.set(r.companyId, existing)
    }
    const companyComparison = Array.from(companyTotals.entries())
      .map(([cId, data]) => ({
        company: companyMap.get(cId)?.name || '알 수 없음',
        amountKRW: convertToKRW(data.gross, data.currency),
        originalAmount: formatCurrency(data.gross, data.currency),
      }))
      .sort((a, b) => b.amountKRW - a.amountKRW)

    // Composition ratio (simplified)
    const compositionRatio = months.map((m) => {
      const d = monthMap.get(m)
      if (!d || d.total === 0) return { month: m, basePct: 0, allowancePct: 0, deductionPct: 0 }
      const grossPct = Math.round((d.gross / (d.gross + d.deductions)) * 100)
      return { month: m, basePct: grossPct, allowancePct: 0, deductionPct: 100 - grossPct }
    })

    const response: PayrollResponse = {
      kpis: {
        monthlyTotal: { label: '월 인건비', value: formatCurrency(latestTotal, displayCurrency), severity: 'neutral' },
        changeRate: {
          label: '전월 대비', value: changeRate, unit: '%',
          change: changeRate, changeLabel: '전월 대비',
          severity: changeRate > 0 ? 'negative' : 'positive',
        },
        perCapita: { label: '1인당 평균', value: formatCurrency(perCapita, displayCurrency), severity: 'neutral' },
        anomalyCount: { label: '이상감지 건수', value: anomalyCount, unit: '건', severity: anomalyCount > 0 ? 'negative' : 'neutral' },
      },
      charts: { monthlyTrend, companyComparison, compositionRatio },
      currency: displayCurrency,
    }

    return apiSuccess(response)
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
