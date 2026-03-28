// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/global?year=X&month=Y
// 글로벌 급여 통합 분석 — 법인별 KRW 환산 집계
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { z } from 'zod'

const querySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

const COMPANY_ORDER = ['CTR', 'CTR-CN', 'CTR-US', 'CTR-VN', 'CTR-EU', 'CTR-RU']

export const GET = withPermission(
  async (req: NextRequest) => {
    const params = Object.fromEntries(new URL(req.url).searchParams)
    const { year, month } = querySchema.parse(params)

    // yearMonth 형식 (YYYY-MM)
    const yearMonthStr = `${year}-${String(month).padStart(2, '0')}`

    // 1) 모든 법인 조회
    const companies = await prisma.company.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, name: true, code: true, currency: true },
    })

    // 2) 환율 조회 (해당 월)
    const exchangeRates = await prisma.exchangeRate.findMany({
      where: { year, month, toCurrency: 'KRW' },
    })
    const rateMap: Record<string, number> = { KRW: 1 }
    for (const er of exchangeRates) {
      rateMap[er.fromCurrency] = Number(er.rate)
    }

    // 3) 급여 실행 및 집계 (yearMonth 기반)
    const payrollRuns = await prisma.payrollRun.findMany({
      where: { yearMonth: yearMonthStr },
      select: { id: true, companyId: true, currency: true, totalGross: true, totalNet: true, status: true },
    })

    // 4) 법인별 집계 (PayrollRun 기반 + PayrollItem으로 headcount 보정)
    const companyStats = await Promise.all(
      companies.map(async (co) => {
        const runs = payrollRuns.filter(r => r.companyId === co.id)
        const currency = runs[0]?.currency ?? co.currency ?? 'KRW'
        const rate = rateMap[currency] ?? 1
        const totalGrossLocal = runs.reduce((s, r) => s + Number(r.totalGross ?? 0), 0)
        const totalNetLocal = runs.reduce((s, r) => s + Number(r.totalNet ?? 0), 0)
        const totalGrossKRW = totalGrossLocal * rate
        const totalNetKRW = totalNetLocal * rate

        // headcount from PayrollItems
        const headcount = await prisma.payrollItem.count({
          where: { run: { companyId: co.id, yearMonth: yearMonthStr } },
        })

        const avgPerHeadKRW = headcount > 0 ? totalGrossKRW / headcount : 0

        return {
          companyId: co.id,
          companyCode: co.code,
          companyName: co.name,
          currency,
          exchangeRate: rate,
          totalGrossLocal,
          totalNetLocal,
          totalGrossKRW,
          totalNetKRW,
          headcount,
          avgPerHeadKRW,
          hasData: runs.length > 0,
        }
      })
    )

    // 5) 전체 합계
    const totalKRW = companyStats.reduce((s, c) => s + c.totalGrossKRW, 0)
    const totalHeadcount = companyStats.reduce((s, c) => s + c.headcount, 0)

    // 6) 월별 트렌드 (최근 6개월) — 병렬 처리
    const trendMonths = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(year, month - 1 - (5 - i), 1)
      return { y: d.getFullYear(), m: d.getMonth() + 1 }
    })

    const trend = await Promise.all(
      trendMonths.map(async ({ y, m }) => {
        const ym = `${y}-${String(m).padStart(2, '0')}`
        const [rates, runs, hc] = await Promise.all([
          prisma.exchangeRate.findMany({ where: { year: y, month: m, toCurrency: 'KRW' } }),
          prisma.payrollRun.findMany({ where: { yearMonth: ym }, select: { currency: true, totalGross: true } }),
          prisma.payrollItem.count({ where: { run: { yearMonth: ym } } }),
        ])
        const rm: Record<string, number> = { KRW: 1 }
        for (const r of rates) rm[r.fromCurrency] = Number(r.rate)
        const totalKRW = runs.reduce((s, r) => s + Number(r.totalGross ?? 0) * (rm[r.currency ?? 'KRW'] ?? 1), 0)
        return { year: y, month: m, totalKRW, headcount: hc }
      })
    )

    // 7) 정렬: COMPANY_ORDER 기준
    companyStats.sort((a, b) => {
      const ai = COMPANY_ORDER.indexOf(a.companyCode)
      const bi = COMPANY_ORDER.indexOf(b.companyCode)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })

    return apiSuccess({
      year,
      month,
      totalKRW,
      totalHeadcount,
      companies: companyStats,
      trend,
      hasExchangeRates: exchangeRates.length > 0,
    })
  },
  { module: MODULE.PAYROLL, action: ACTION.VIEW }
)
