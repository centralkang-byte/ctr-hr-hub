// ═══════════════════════════════════════════════════════════
// Phase 2-A: KPI Drilldown API (Lazy Loading)
// GET /api/v1/analytics/executive/drilldown?type={kpiType}
// AD-1: summary와 분리 — Sheet 오픈 시에만 호출
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { parseAnalyticsParams, generateMonthRange, toYearMonth } from '@/lib/analytics/parse-params'
import { convertToKRW, formatCurrency } from '@/lib/analytics/currency'
import { TURNOVER_BENCHMARKS, TENURE_BENCHMARKS } from '@/lib/analytics/benchmarks'
import type { KpiDrilldownData, KpiDrilldownType } from '@/lib/analytics/types'
import type { SessionUser } from '@/types'

const VALID_TYPES: KpiDrilldownType[] = ['headcount', 'turnover', 'tenure', 'laborCost', 'recruitment', 'onboarding']

export const GET = withPermission(
  async (req: NextRequest, _ctx, _user: SessionUser) => {
    const url = new URL(req.url)
    const type = url.searchParams.get('type') as KpiDrilldownType | null
    if (!type || !VALID_TYPES.includes(type)) {
      throw badRequest('유효하지 않은 드릴다운 타입입니다.')
    }

    const params = parseAnalyticsParams(url.searchParams)
    const companyFilter = params.companyId ? { companyId: params.companyId } : {}
    const now = new Date()
    const months = generateMonthRange(params.startDate, params.endDate)

    const companies = await prisma.company.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, currency: true },
    })


    // 공통: 현재 재직자
    const activeEmployees = await prisma.employeeAssignment.findMany({
      where: { ...companyFilter, status: 'ACTIVE', isPrimary: true, endDate: null },
      select: { employeeId: true, companyId: true, employee: { select: { hireDate: true } } },
    })

    let result: KpiDrilldownData

    switch (type) {
      case 'headcount': {
        // 법인별 인원 + 월별 입퇴사 추이
        const companyCount = new Map<string, number>()
        for (const a of activeEmployees) {
          companyCount.set(a.companyId, (companyCount.get(a.companyId) || 0) + 1)
        }

        const hires = await prisma.employeeAssignment.findMany({
          where: { ...companyFilter, isPrimary: true, changeType: 'HIRE', effectiveDate: { gte: params.startDate, lte: params.endDate } },
          select: { effectiveDate: true },
        })
        const exits = await prisma.employeeAssignment.findMany({
          where: { ...companyFilter, isPrimary: true, status: { in: ['RESIGNED', 'TERMINATED'] }, endDate: { gte: params.startDate, lte: params.endDate } },
          select: { endDate: true },
        })

        const monthlyNet = new Map<string, number>()
        for (const h of hires) {
          const m = toYearMonth(new Date(h.effectiveDate))
          monthlyNet.set(m, (monthlyNet.get(m) || 0) + 1)
        }
        for (const e of exits) {
          if (e.endDate) {
            const m = toYearMonth(new Date(e.endDate))
            monthlyNet.set(m, (monthlyNet.get(m) || 0) - 1)
          }
        }

        result = {
          kpiType: 'headcount',
          currentValue: activeEmployees.length,
          unit: '명',
          companyBreakdown: companies
            .map((c) => ({ companyId: c.id, companyName: c.name, value: companyCount.get(c.id) || 0 }))
            .filter((c) => c.value > 0)
            .sort((a, b) => b.value - a.value),
          monthlyTrend: months.map((m) => ({ month: m, value: monthlyNet.get(m) || 0 })),
          details: { totalHires: hires.length, totalExits: exits.length },
        }
        break
      }

      case 'turnover': {
        // 법인별 이직률 + 퇴사 사유 Top 5
        const companyCount = new Map<string, number>()
        for (const a of activeEmployees) {
          companyCount.set(a.companyId, (companyCount.get(a.companyId) || 0) + 1)
        }

        const exits = await prisma.employeeAssignment.findMany({
          where: { ...companyFilter, isPrimary: true, status: { in: ['RESIGNED', 'TERMINATED'] }, endDate: { gte: params.startDate, lte: params.endDate } },
          select: { endDate: true, companyId: true },
        })

        const monthlyExits = new Map<string, number>()
        const companyExits = new Map<string, number>()
        for (const e of exits) {
          if (e.endDate) {
            const m = toYearMonth(new Date(e.endDate))
            monthlyExits.set(m, (monthlyExits.get(m) || 0) + 1)
            companyExits.set(e.companyId, (companyExits.get(e.companyId) || 0) + 1)
          }
        }

        const totalEmps = activeEmployees.length
        const currentMonthExits = monthlyExits.get(toYearMonth(now)) || 0
        const currentRate = totalEmps > 0 ? Math.round((currentMonthExits / totalEmps) * 1000) / 10 : 0

        result = {
          kpiType: 'turnover',
          currentValue: currentRate,
          unit: '%',
          benchmark: { label: TURNOVER_BENCHMARKS.manufacturing.label, value: TURNOVER_BENCHMARKS.manufacturing.value },
          companyBreakdown: companies
            .map((c) => {
              const hc = companyCount.get(c.id) || 0
              const ex = companyExits.get(c.id) || 0
              const rate = hc > 0 ? Math.round((ex / hc) * 1000) / 10 : 0
              return { companyId: c.id, companyName: c.name, value: rate, subValue: `${ex}명 퇴사` }
            })
            .filter((c) => (companyCount.get(c.companyId) || 0) > 0)
            .sort((a, b) => b.value - a.value),
          monthlyTrend: months.map((m) => {
            const ex = monthlyExits.get(m) || 0
            return { month: m, value: totalEmps > 0 ? Math.round((ex / totalEmps) * 1000) / 10 : 0 }
          }),
        }
        break
      }

      case 'tenure': {
        // 근속 분포 + 법인별 평균
        const companyTenures = new Map<string, number[]>()
        const ranges = [
          { label: '1년 미만', min: 0, max: 1 },
          { label: '1-3년', min: 1, max: 3 },
          { label: '3-5년', min: 3, max: 5 },
          { label: '5-10년', min: 5, max: 10 },
          { label: '10년 이상', min: 10, max: Infinity },
        ]
        const rangeCounts = ranges.map((r) => ({ range: r.label, count: 0 }))

        for (const a of activeEmployees) {
          const hd = a.employee?.hireDate
          if (!hd) continue
          const years = (now.getTime() - new Date(hd).getTime()) / (365.25 * 24 * 60 * 60 * 1000)

          if (!companyTenures.has(a.companyId)) companyTenures.set(a.companyId, [])
          companyTenures.get(a.companyId)!.push(years)

          for (let i = 0; i < ranges.length; i++) {
            if (years >= ranges[i].min && years < ranges[i].max) {
              rangeCounts[i].count++
              break
            }
          }
        }

        const allTenures = Array.from(companyTenures.values()).flat()
        const avgTenure = allTenures.length > 0 ? Math.round((allTenures.reduce((a, b) => a + b, 0) / allTenures.length) * 10) / 10 : 0

        result = {
          kpiType: 'tenure',
          currentValue: avgTenure,
          unit: '년',
          benchmark: { label: TENURE_BENCHMARKS.manufacturing.label, value: TENURE_BENCHMARKS.manufacturing.value },
          companyBreakdown: companies
            .map((c) => {
              const tenures = companyTenures.get(c.id) || []
              const avg = tenures.length > 0 ? Math.round((tenures.reduce((a, b) => a + b, 0) / tenures.length) * 10) / 10 : 0
              return { companyId: c.id, companyName: c.name, value: avg, subValue: `${tenures.length}명` }
            })
            .filter((c) => c.subValue !== '0명')
            .sort((a, b) => b.value - a.value),
          monthlyTrend: [], // 근속은 월별 추이 의미 없음
          details: { tenureDistribution: rangeCounts },
        }
        break
      }

      case 'laborCost': {
        // 법인별 인건비 + 월별 추이
        const payrollRuns = await prisma.payrollRun.findMany({
          where: { ...companyFilter, status: { in: ['APPROVED', 'PAID'] } },
          orderBy: { yearMonth: 'desc' },
          take: 200,
          select: { companyId: true, totalGross: true, currency: true, yearMonth: true, headcount: true },
        })

        const latestMonth = payrollRuns[0]?.yearMonth
        const latestPayrolls = payrollRuns.filter((p) => p.yearMonth === latestMonth)
        let totalKRW = 0
        for (const p of latestPayrolls) totalKRW += convertToKRW(Number(p.totalGross || 0), p.currency)

        // 월별 추이
        const monthlyMap = new Map<string, number>()
        for (const p of payrollRuns) {
          const krw = convertToKRW(Number(p.totalGross || 0), p.currency)
          monthlyMap.set(p.yearMonth, (monthlyMap.get(p.yearMonth) || 0) + krw)
        }

        result = {
          kpiType: 'laborCost',
          currentValue: formatCurrency(totalKRW, 'KRW') || '₩0',
          companyBreakdown: companies
            .map((c) => {
              const cp = latestPayrolls.filter((p) => p.companyId === c.id)
              let cost = 0
              for (const p of cp) cost += convertToKRW(Number(p.totalGross || 0), p.currency)
              const hc = cp.reduce((sum, p) => sum + (p.headcount || 0), 0)
              return {
                companyId: c.id,
                companyName: c.name,
                value: cost,
                subValue: hc > 0 ? `1인당 ${formatCurrency(Math.round(cost / hc), 'KRW') || '₩0'}` : undefined,
              }
            })
            .filter((c) => c.value > 0)
            .sort((a, b) => b.value - a.value),
          monthlyTrend: Array.from(monthlyMap.entries())
            .map(([month, value]) => ({ month, value }))
            .sort((a, b) => a.month.localeCompare(b.month)),
        }
        break
      }

      case 'recruitment': {
        // 공고별 현황
        const postings = await prisma.jobPosting.findMany({
          where: { ...companyFilter, status: 'OPEN' },
          select: { id: true, title: true, companyId: true, createdAt: true },
        })

        const applications = await prisma.application.groupBy({
          by: ['stage'],
          _count: { _all: true },
          where: { posting: { ...companyFilter, status: 'OPEN' } },
        })

        const stageMap = new Map(applications.map((a) => [a.stage, a._count._all]))
        const total = Array.from(stageMap.values()).reduce((s, c) => s + c, 0)

        // 법인별 공고수
        const companyPostings = new Map<string, number>()
        for (const p of postings) {
          companyPostings.set(p.companyId, (companyPostings.get(p.companyId) || 0) + 1)
        }

        result = {
          kpiType: 'recruitment',
          currentValue: `공고 ${postings.length}건`,
          companyBreakdown: companies
            .map((c) => ({
              companyId: c.id,
              companyName: c.name,
              value: companyPostings.get(c.id) || 0,
              subValue: `${companyPostings.get(c.id) || 0}건 진행중`,
            }))
            .filter((c) => c.value > 0)
            .sort((a, b) => b.value - a.value),
          monthlyTrend: [],
          details: { totalApplications: total, byStage: Object.fromEntries(stageMap) },
        }
        break
      }

      case 'onboarding': {
        // 법인별 온보딩 현황
        const activeOnb = await prisma.employeeOnboarding.findMany({
          where: { ...companyFilter, status: { in: ['NOT_STARTED', 'IN_PROGRESS'] } },
          select: { companyId: true, status: true },
        })
        const completedOnb = await prisma.employeeOnboarding.count({
          where: { ...companyFilter, status: 'COMPLETED', completedAt: { gte: params.startDate } },
        })

        const totalOnb = activeOnb.length + completedOnb
        const rate = totalOnb > 0 ? Math.round((completedOnb / totalOnb) * 1000) / 10 : 0

        const companyOnb = new Map<string, { active: number; completed: number }>()
        for (const o of activeOnb) {
          const cId = o.companyId
          if (!cId) continue
          if (!companyOnb.has(cId)) companyOnb.set(cId, { active: 0, completed: 0 })
          companyOnb.get(cId)!.active++
        }

        result = {
          kpiType: 'onboarding',
          currentValue: rate,
          unit: '%',
          companyBreakdown: companies
            .map((c) => {
              const data = companyOnb.get(c.id)
              return {
                companyId: c.id,
                companyName: c.name,
                value: data?.active || 0,
                subValue: `진행중 ${data?.active || 0}명`,
              }
            })
            .filter((c) => c.value > 0)
            .sort((a, b) => b.value - a.value),
          monthlyTrend: [],
          details: { completedCount: completedOnb, totalCount: totalOnb, completionRate: rate },
        }
        break
      }
    }

    return apiSuccess(result)
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
