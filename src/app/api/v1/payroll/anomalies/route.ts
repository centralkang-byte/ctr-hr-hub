// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/anomalies?year=X&month=Y
// 급여 이상 탐지 — 4가지 규칙 자동 분석
// ─────────────────────────────────────────────────────────
// Rule 1: 밴드 이탈 — 직급별 급여 밴드 벗어남
// Rule 2: 내부 분산 — 동일 법인·직급 내 급여 편차 과다
// Rule 3: 법인간 격차 — 동일 직급 법인 간 인당평균 2배+
// Rule 4: 급격한 변화 — 전월 대비 20%+ 변동
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { resolveCompanyId } from '@/lib/api/companyFilter'
import { z } from 'zod'
import type { SessionUser } from '@/types'

const querySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

type Severity = 'high' | 'medium' | 'low'

interface Anomaly {
  rule: string
  severity: Severity
  description: string
  affectedCount: number
  details: Record<string, unknown>[]
}

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const searchParams = new URL(req.url).searchParams
    const params = Object.fromEntries(searchParams)
    const { year, month } = querySchema.parse(params)
    const yearMonthStr = `${year}-${String(month).padStart(2, '0')}`
    const companyId = resolveCompanyId(user, searchParams.get('companyId'))

    const anomalies: Anomaly[] = []

    // ── 공통 데이터 로드 ───────────────────────────────────
    const payrollItems = await prisma.payrollItem.findMany({
      where: { run: { yearMonth: yearMonthStr, companyId } },
      include: {
        employee: {
          include: {
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              include: { jobGrade: true, company: true },
            },
          },
        },
        run: {
          select: {
            companyId: true,
            currency: true,
            yearMonth: true,
            company: { select: { code: true, name: true } },
          },
        },
      },
    })

    // ── Rule 1: 직급별 급여 밴드 이탈 ─────────────────────
    const salaryBands = await prisma.salaryBand.findMany({
      where: { deletedAt: null },
      select: { jobGradeId: true, minSalary: true, maxSalary: true, currency: true },
    })
    const bandMap = new Map(salaryBands.map(b => [b.jobGradeId, b]))

    const bandBreaches: Record<string, unknown>[] = []
    for (const item of payrollItems) {
      const assignment = item.employee.assignments[0]
      if (!assignment?.jobGradeId) continue
      const band = bandMap.get(assignment.jobGradeId)
      if (!band) continue
      const gross = Number(item.grossPay ?? 0)
      const minB = Number(band.minSalary)
      const maxB = Number(band.maxSalary)
      if (gross < minB || gross > maxB) {
        bandBreaches.push({
          employeeId: item.employeeId,
          employeeName: item.employee.name,
          company: item.run.company?.code,
          jobGrade: (assignment.jobGrade as { name?: string } | undefined)?.name,
          grossPay: gross,
          currency: item.run.currency,
          minBand: minB,
          maxBand: maxB,
          direction: gross < minB ? '하한 이탈' : '상한 초과',
        })
      }
    }
    if (bandBreaches.length > 0) {
      anomalies.push({
        rule: '밴드 이탈',
        severity: 'high',
        description: `직급별 급여 밴드를 벗어난 직원 ${bandBreaches.length}명 발견`,
        affectedCount: bandBreaches.length,
        details: bandBreaches.slice(0, 10),
      })
    }

    // ── Rule 2: 내부 분산 과다 ────────────────────────────
    type GroupKey = string
    const groups = new Map<GroupKey, { grossList: number[]; items: typeof payrollItems }>()
    for (const item of payrollItems) {
      const a = item.employee.assignments[0]
      if (!a?.companyId || !a?.jobGradeId) continue
      const key = `${a.companyId}:${a.jobGradeId}`
      if (!groups.has(key)) groups.set(key, { grossList: [], items: [] })
      const g = groups.get(key)!
      g.grossList.push(Number(item.grossPay ?? 0))
      g.items.push(item)
    }

    const varianceAnomalies: Record<string, unknown>[] = []
    for (const [, { grossList, items }] of groups) {
      if (grossList.length < 3) continue
      const mean = grossList.reduce((s, v) => s + v, 0) / grossList.length
      const std = Math.sqrt(grossList.reduce((s, v) => s + (v - mean) ** 2, 0) / grossList.length)
      const cv = mean > 0 ? std / mean : 0
      if (cv > 0.30) {
        const a = items[0].employee.assignments[0]
        varianceAnomalies.push({
          companyCode: items[0].run.company?.code,
          jobGrade: (a?.jobGrade as { name?: string } | undefined)?.name,
          count: grossList.length,
          mean: Math.round(mean),
          std: Math.round(std),
          cv: `${(cv * 100).toFixed(1)}%`,
          currency: items[0].run.currency,
        })
      }
    }
    if (varianceAnomalies.length > 0) {
      anomalies.push({
        rule: '내부 분산 과다',
        severity: 'medium',
        description: `동일 법인·직급 내 급여 편차가 30% 초과하는 그룹 ${varianceAnomalies.length}개 발견`,
        affectedCount: varianceAnomalies.length,
        details: varianceAnomalies,
      })
    }

    // ── Rule 3: 법인간 격차 (같은 직급 인당 평균 2배+) ───
    const exchangeRates = await prisma.exchangeRate.findMany({
      where: { year, month, toCurrency: 'KRW' },
    })
    const rateMap: Record<string, number> = { KRW: 1 }
    for (const r of exchangeRates) rateMap[r.fromCurrency] = Number(r.rate)

    const gradeMap = new Map<string, { companyCode: string; avgKRW: number; count: number; gradeName: string }[]>()
    for (const [key, { grossList, items }] of groups) {
      const [, gradeId] = key.split(':')
      if (!gradeId) continue
      const a = items[0].employee.assignments[0]
      const currency = items[0].run.currency ?? 'KRW'
      const rate = rateMap[currency] ?? 1
      const avgLocal = grossList.reduce((s, v) => s + v, 0) / grossList.length
      const avgKRW = avgLocal * rate
      if (!gradeMap.has(gradeId)) gradeMap.set(gradeId, [])
      gradeMap.get(gradeId)!.push({
        companyCode: items[0].run.company?.code ?? '?',
        avgKRW,
        count: grossList.length,
        gradeName: (a?.jobGrade as { name?: string } | undefined)?.name ?? gradeId,
      })
    }

    const crossEntityAnomalies: Record<string, unknown>[] = []
    for (const [, entries] of gradeMap) {
      if (entries.length < 2) continue
      const sorted = entries.sort((a, b) => b.avgKRW - a.avgKRW)
      const ratio = sorted[0].avgKRW / Math.max(sorted[sorted.length - 1].avgKRW, 1)
      if (ratio >= 2) {
        crossEntityAnomalies.push({
          gradeName: sorted[0].gradeName,
          maxCompany: sorted[0].companyCode,
          maxAvgKRW: Math.round(sorted[0].avgKRW),
          minCompany: sorted[sorted.length - 1].companyCode,
          minAvgKRW: Math.round(sorted[sorted.length - 1].avgKRW),
          ratio: ratio.toFixed(1),
        })
      }
    }
    if (crossEntityAnomalies.length > 0) {
      anomalies.push({
        rule: '법인간 격차',
        severity: 'medium',
        description: `동일 직급 법인 간 인당 평균 급여가 2배 이상 차이나는 직급 ${crossEntityAnomalies.length}개 발견`,
        affectedCount: crossEntityAnomalies.length,
        details: crossEntityAnomalies,
      })
    }

    // ── Rule 4: 급격한 변화 (전월 대비 20%+) ─────────────
    const prevDate = new Date(year, month - 2, 1)
    const prevYM = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
    const prevItems = await prisma.payrollItem.findMany({
      where: { run: { yearMonth: prevYM, companyId } },
      select: { employeeId: true, grossPay: true },
    })
    const prevMap = new Map(prevItems.map(i => [i.employeeId, Number(i.grossPay ?? 0)]))

    const suddenChanges: Record<string, unknown>[] = []
    for (const item of payrollItems) {
      const prev = prevMap.get(item.employeeId)
      if (!prev || prev === 0) continue
      const curr = Number(item.grossPay ?? 0)
      const delta = Math.abs((curr - prev) / prev)
      if (delta >= 0.20) {
        suddenChanges.push({
          employeeId: item.employeeId,
          employeeName: item.employee.name,
          company: item.run.company?.code,
          prev,
          curr,
          changePercent: `${curr > prev ? '+' : ''}${((curr - prev) / prev * 100).toFixed(1)}%`,
          currency: item.run.currency,
        })
      }
    }
    if (suddenChanges.length > 0) {
      anomalies.push({
        rule: '급격한 변화',
        severity: 'high',
        description: `전월 대비 급여가 20% 이상 변동한 직원 ${suddenChanges.length}명 발견`,
        affectedCount: suddenChanges.length,
        details: suddenChanges.slice(0, 10),
      })
    }

    return apiSuccess({
      year,
      month,
      totalAnomalies: anomalies.reduce((s, a) => s + a.affectedCount, 0),
      anomalies,
      scannedCount: payrollItems.length,
    })
  },
  perm(MODULE.PAYROLL, ACTION.VIEW)
)
