// ═══════════════════════════════════════════════════════════
// GET /api/v1/dashboard/compare — 법인 비교 분석 (Phase 2-B1)
// 8종 KPI × N법인 배치 쿼리, 백분위 순위, YoY 비교
// ═══════════════════════════════════════════════════════════
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import type { CompareKpiKey } from '@/lib/analytics/types'

// ─── Constants ──────────────────────────────────────────────

const ALL_KPI_KEYS: CompareKpiKey[] = [
  'turnover_rate', 'leave_usage', 'training_completion', 'payroll_cost',
  'headcount', 'avg_tenure', 'overtime_rate', 'training_hours',
]

const KPI_META: Record<CompareKpiKey, { label: string; unit: string; invertBetter?: boolean }> = {
  turnover_rate: { label: '이직률', unit: '%', invertBetter: true },
  leave_usage: { label: '연차 사용률', unit: '%' },
  training_completion: { label: '교육 이수율', unit: '%' },
  payroll_cost: { label: '인건비', unit: '백만 KRW' },
  headcount: { label: '인원', unit: '명' },
  avg_tenure: { label: '평균 근속', unit: '년' },
  overtime_rate: { label: '초과근무 비율', unit: '%', invertBetter: true },
  training_hours: { label: '교육시간', unit: '시간/인' },
}

// ─── Batch KPI Calculators (GROUP BY — N+1 방지) ────────────

type CompanyKpiMap = Map<string, number | null>

async function calcHeadcountBatch(companyIds: string[]): Promise<CompanyKpiMap> {
  const rows = await prisma.employeeAssignment.groupBy({
    by: ['companyId'],
    where: { companyId: { in: companyIds }, isPrimary: true, endDate: null, status: 'ACTIVE' },
    _count: true,
  })
  const map: CompanyKpiMap = new Map(companyIds.map(id => [id, 0]))
  for (const r of rows) map.set(r.companyId, r._count)
  return map
}

async function calcTurnoverBatch(companyIds: string[], year: number): Promise<CompanyKpiMap> {
  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31)

  const [terminated, bases] = await Promise.all([
    prisma.employeeAssignment.groupBy({
      by: ['companyId'],
      where: { companyId: { in: companyIds }, isPrimary: true, status: 'TERMINATED', endDate: { gte: start, lte: end } },
      _count: true,
    }),
    prisma.employeeAssignment.groupBy({
      by: ['companyId'],
      where: {
        companyId: { in: companyIds }, isPrimary: true,
        effectiveDate: { lte: start },
        OR: [{ endDate: null }, { endDate: { gt: start } }],
      },
      _count: true,
    }),
  ])

  const termMap = new Map(terminated.map(r => [r.companyId, r._count]))
  const baseMap = new Map(bases.map(r => [r.companyId, r._count]))

  const map: CompanyKpiMap = new Map()
  for (const id of companyIds) {
    const t = termMap.get(id) ?? 0
    const b = baseMap.get(id) ?? 0
    map.set(id, b > 0 ? Math.round((t / b) * 1000) / 10 : null)
  }
  return map
}

async function calcLeaveUsageBatch(companyIds: string[], year: number): Promise<CompanyKpiMap> {
  const balances = await prisma.leaveYearBalance.findMany({
    where: {
      year,
      employee: { assignments: { some: { companyId: { in: companyIds }, isPrimary: true, endDate: null } } },
      entitled: { gt: 0 },
    },
    select: { entitled: true, used: true, employee: { select: { assignments: { where: { isPrimary: true, endDate: null }, select: { companyId: true }, take: 1 } } } },
  })

  // 법인별 사용률 집계
  const sums = new Map<string, { total: number; count: number }>()
  for (const b of balances) {
    const cId = b.employee.assignments[0]?.companyId
    if (!cId) continue
    const s = sums.get(cId) ?? { total: 0, count: 0 }
    s.total += b.used / b.entitled
    s.count++
    sums.set(cId, s)
  }

  const map: CompanyKpiMap = new Map()
  for (const id of companyIds) {
    const s = sums.get(id)
    map.set(id, s && s.count > 0 ? Math.round((s.total / s.count) * 1000) / 10 : null)
  }
  return map
}

async function calcTrainingCompletionBatch(companyIds: string[], year: number): Promise<CompanyKpiMap> {
  const yearStart = new Date(year, 0, 1)

  const [totals, completed] = await Promise.all([
    prisma.trainingEnrollment.groupBy({
      by: ['employeeId'],
      where: {
        enrolledAt: { gte: yearStart },
        employee: { assignments: { some: { companyId: { in: companyIds }, isPrimary: true } } },
      },
      _count: true,
    }),
    prisma.trainingEnrollment.groupBy({
      by: ['employeeId'],
      where: {
        status: 'ENROLLMENT_COMPLETED',
        enrolledAt: { gte: yearStart },
        employee: { assignments: { some: { companyId: { in: companyIds }, isPrimary: true } } },
      },
      _count: true,
    }),
  ])

  // employeeId → companyId 매핑 필요 — 벌크 조회
  const employeeIds = [...new Set([...totals, ...completed].map(r => r.employeeId))]
  const assignments = employeeIds.length > 0
    ? await prisma.employeeAssignment.findMany({
        where: { employeeId: { in: employeeIds }, isPrimary: true, endDate: null, companyId: { in: companyIds } },
        select: { employeeId: true, companyId: true },
      })
    : []
  const empToCompany = new Map(assignments.map(a => [a.employeeId, a.companyId]))

  const companyTotals = new Map<string, number>()
  const companyDone = new Map<string, number>()
  for (const r of totals) {
    const cId = empToCompany.get(r.employeeId)
    if (cId) companyTotals.set(cId, (companyTotals.get(cId) ?? 0) + r._count)
  }
  for (const r of completed) {
    const cId = empToCompany.get(r.employeeId)
    if (cId) companyDone.set(cId, (companyDone.get(cId) ?? 0) + r._count)
  }

  const map: CompanyKpiMap = new Map()
  for (const id of companyIds) {
    const t = companyTotals.get(id) ?? 0
    const d = companyDone.get(id) ?? 0
    map.set(id, t > 0 ? Math.round((d / t) * 1000) / 10 : null)
  }
  return map
}

async function calcPayrollCostBatch(companyIds: string[], year: number): Promise<CompanyKpiMap> {
  const runs = await prisma.payrollRun.findMany({
    where: { companyId: { in: companyIds }, yearMonth: { startsWith: year.toString() }, status: { in: ['APPROVED', 'PAID'] } },
    include: { payrollItems: { select: { grossPay: true } }, company: { select: { currency: true } } },
  })

  // 환율 조회 (법인 통화별)
  const currencies = [...new Set(runs.map(r => r.company?.currency).filter((c): c is string => !!c && c !== 'KRW'))]
  const exchangeRates = new Map<string, number>()
  for (const cur of currencies) {
    const er = await prisma.exchangeRate.findFirst({
      where: { fromCurrency: cur, toCurrency: 'KRW', year },
      orderBy: { month: 'desc' },
    })
    if (er) exchangeRates.set(cur, Number(er.rate))
  }

  const map: CompanyKpiMap = new Map()
  for (const id of companyIds) {
    const companyRuns = runs.filter(r => r.companyId === id)
    if (companyRuns.length === 0) { map.set(id, null); continue }
    const totalLocal = companyRuns.reduce(
      (s, r) => s + r.payrollItems.reduce((ss, i) => ss + Number(i.grossPay), 0), 0
    )
    const cur = companyRuns[0].company?.currency
    const rate = (cur && cur !== 'KRW') ? (exchangeRates.get(cur) ?? 1) : 1
    map.set(id, Math.round((totalLocal * rate) / 1000000))
  }
  return map
}

async function calcAvgTenureBatch(companyIds: string[]): Promise<CompanyKpiMap> {
  const employees = await prisma.employee.findMany({
    where: {
      deletedAt: null,
      assignments: { some: { companyId: { in: companyIds }, isPrimary: true, endDate: null, status: 'ACTIVE' } },
    },
    select: {
      hireDate: true,
      assignments: { where: { isPrimary: true, endDate: null }, select: { companyId: true }, take: 1 },
    },
  })

  const sums = new Map<string, { total: number; count: number }>()
  const now = new Date()
  for (const e of employees) {
    const cId = e.assignments[0]?.companyId
    if (!cId || !e.hireDate) continue
    const years = (now.getTime() - new Date(e.hireDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    const s = sums.get(cId) ?? { total: 0, count: 0 }
    s.total += years
    s.count++
    sums.set(cId, s)
  }

  const map: CompanyKpiMap = new Map()
  for (const id of companyIds) {
    const s = sums.get(id)
    map.set(id, s && s.count > 0 ? Math.round((s.total / s.count) * 10) / 10 : null)
  }
  return map
}

async function calcOvertimeRateBatch(companyIds: string[]): Promise<CompanyKpiMap> {
  // 최근 4주 기준 주 52시간 초과 비율
  const fourWeeksAgo = new Date()
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

  const records = await prisma.attendance.findMany({
    where: {
      workDate: { gte: fourWeeksAgo },
      employee: { assignments: { some: { companyId: { in: companyIds }, isPrimary: true, endDate: null } } },
      overtimeMinutes: { gt: 0 },
    },
    select: {
      employee: { select: { assignments: { where: { isPrimary: true, endDate: null }, select: { companyId: true }, take: 1 } } },
    },
  })

  // headcount 대비 초과근무자 비율
  const headcountMap = await calcHeadcountBatch(companyIds)
  // 간단히 초과근무 기록 수 / 총 인원으로 근사
  const overtimeCounts = new Map<string, number>()
  for (const r of records) {
    const cId = r.employee.assignments[0]?.companyId
    if (cId) overtimeCounts.set(cId, (overtimeCounts.get(cId) ?? 0) + 1)
  }

  const map: CompanyKpiMap = new Map()
  for (const id of companyIds) {
    const hc = headcountMap.get(id) ?? 0
    const ot = overtimeCounts.get(id) ?? 0
    // 4주간 초과근무 기록수 / (인원 × 20영업일) × 100
    map.set(id, hc > 0 ? Math.round((ot / (hc * 20)) * 1000) / 10 : null)
  }
  return map
}

async function calcTrainingHoursBatch(companyIds: string[], year: number): Promise<CompanyKpiMap> {
  const yearStart = new Date(year, 0, 1)
  const enrollments = await prisma.trainingEnrollment.findMany({
    where: {
      status: 'ENROLLMENT_COMPLETED',
      enrolledAt: { gte: yearStart },
      employee: { assignments: { some: { companyId: { in: companyIds }, isPrimary: true } } },
    },
    select: {
      course: { select: { durationHours: true } },
      employee: { select: { assignments: { where: { isPrimary: true, endDate: null }, select: { companyId: true }, take: 1 } } },
    },
  })

  const sums = new Map<string, { hours: number; employees: Set<string> }>()
  for (const e of enrollments) {
    const cId = e.employee.assignments[0]?.companyId
    if (!cId) continue
    const s = sums.get(cId) ?? { hours: 0, employees: new Set() }
    s.hours += Number(e.course?.durationHours ?? 0)
    sums.set(cId, s)
  }

  const headcountMap = await calcHeadcountBatch(companyIds)
  const map: CompanyKpiMap = new Map()
  for (const id of companyIds) {
    const s = sums.get(id)
    const hc = headcountMap.get(id) ?? 0
    map.set(id, s && hc > 0 ? Math.round((s.hours / hc) * 10) / 10 : null)
  }
  return map
}

// ─── Batch Orchestrator ─────────────────────────────────────

const BATCH_CALCULATORS: Record<CompareKpiKey, (ids: string[], year: number) => Promise<CompanyKpiMap>> = {
  headcount: (ids) => calcHeadcountBatch(ids),
  turnover_rate: calcTurnoverBatch,
  leave_usage: calcLeaveUsageBatch,
  training_completion: calcTrainingCompletionBatch,
  payroll_cost: calcPayrollCostBatch,
  avg_tenure: (ids) => calcAvgTenureBatch(ids),
  overtime_rate: (ids) => calcOvertimeRateBatch(ids),
  training_hours: calcTrainingHoursBatch,
}

async function calcAllKpisForCompanies(
  companyIds: string[],
  year: number,
  kpis: CompareKpiKey[] = ALL_KPI_KEYS,
): Promise<Map<string, Partial<Record<CompareKpiKey, number | null>>>> {
  // KPI별 배치 쿼리 병렬 실행
  const results = await Promise.all(
    kpis.map(async (kpi) => ({
      kpi,
      data: await BATCH_CALCULATORS[kpi](companyIds, year),
    }))
  )

  // 법인별로 합치기
  const merged = new Map<string, Partial<Record<CompareKpiKey, number | null>>>()
  for (const id of companyIds) {
    const values: Partial<Record<CompareKpiKey, number | null>> = {}
    for (const { kpi, data } of results) {
      values[kpi] = data.get(id) ?? null
    }
    merged.set(id, values)
  }
  return merged
}

// ─── Percentile Calculation ─────────────────────────────────

function calcPercentiles(
  companyIds: string[],
  values: Map<string, Partial<Record<CompareKpiKey, number | null>>>,
  kpis: CompareKpiKey[],
): Map<string, Partial<Record<CompareKpiKey, number | null>>> {
  const percentiles = new Map<string, Partial<Record<CompareKpiKey, number | null>>>()

  for (const kpi of kpis) {
    // kpi별 non-null 값 수집 + 정렬
    const entries = companyIds
      .map(id => ({ id, v: values.get(id)?.[kpi] ?? null }))
      .filter((e): e is { id: string; v: number } => e.v !== null)
      .sort((a, b) => a.v - b.v)

    const n = entries.length
    for (let i = 0; i < n; i++) {
      const pctile = Math.round(((i + 1) / n) * 100)
      const p = percentiles.get(entries[i].id) ?? {}
      p[kpi] = pctile
      percentiles.set(entries[i].id, p)
    }
    // null인 법인은 percentile도 null
    for (const id of companyIds) {
      if (!percentiles.has(id)) percentiles.set(id, {})
      if (percentiles.get(id)![kpi] === undefined) {
        percentiles.get(id)![kpi] = null
      }
    }
  }

  return percentiles
}

// ─── Route Handler ──────────────────────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { searchParams } = new URL(req.url)

    // 파라미터 파싱
    const kpiParam = searchParams.get('kpi') ?? 'all'
    const parsedYear = parseInt(searchParams.get('year') ?? '', 10)
    const year = !isNaN(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
      ? parsedYear
      : new Date().getFullYear()
    const companiesParam = searchParams.get('companies') // 쉼표 구분 ID
    const yoy = searchParams.get('yoy') === 'true'

    // KPI 목록 결정
    const kpis: CompareKpiKey[] = kpiParam === 'all'
      ? ALL_KPI_KEYS
      : (kpiParam.split(',').filter(k => ALL_KPI_KEYS.includes(k as CompareKpiKey)) as CompareKpiKey[])
    if (kpis.length === 0) kpis.push(...ALL_KPI_KEYS)

    // 법인 필터링 (권한 기반)
    const isGlobalRole =
      user.role === ROLE.SUPER_ADMIN || (user.role === ROLE.HR_ADMIN && !user.companyId)

    const companyFilter = isGlobalRole ? null : (user.companyId ?? null)

    const companiesWhere = {
      ...(companiesParam ? { id: { in: companiesParam.split(',') } } : {}),
      ...(companyFilter ? { id: companyFilter } : {}),
    }

    const companies = await prisma.company.findMany({
      where: Object.keys(companiesWhere).length > 0 ? companiesWhere : undefined,
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    })

    const companyIds = companies.map(c => c.id)

    // 배치 KPI 조회 (+ YoY 병렬)
    const [currentValues, yoyValues] = await Promise.all([
      calcAllKpisForCompanies(companyIds, year, kpis),
      yoy ? calcAllKpisForCompanies(companyIds, year - 1, kpis) : Promise.resolve(null),
    ])

    // 백분위 계산
    const currentPercentiles = calcPercentiles(companyIds, currentValues, kpis)

    // 결과 조립
    const results = companies.map(c => ({
      companyId: c.id,
      company: c.code,
      name: c.name,
      values: currentValues.get(c.id) ?? {},
      percentiles: currentPercentiles.get(c.id) ?? {},
    }))

    const yoyResults = yoyValues
      ? companies.map(c => ({
          companyId: c.id,
          company: c.code,
          name: c.name,
          values: yoyValues.get(c.id) ?? {},
          percentiles: {} as Partial<Record<CompareKpiKey, number | null>>,
        }))
      : undefined

    // 트렌드 (기존 AnalyticsSnapshot 기반 — 단일 KPI 모드일 때만)
    const trendKpi = kpis.length === 1 ? kpis[0] : 'turnover_rate'
    const trendStart = new Date(year, 0, 1)
    const snapshots = await prisma.analyticsSnapshot.findMany({
      where: {
        type: trendKpi,
        snapshotDate: { gte: trendStart },
        ...(companiesParam ? { companyId: { in: companiesParam.split(',') } } : {}),
        ...(companyFilter ? { companyId: companyFilter } : {}),
      },
      orderBy: { snapshotDate: 'asc' },
      select: { companyId: true, snapshotDate: true, data: true },
    })

    const companyCodeMap = new Map(companies.map(c => [c.id, c.code]))
    const trend = snapshots.map(s => ({
      month: (s.snapshotDate as Date).toISOString().slice(0, 7),
      companyId: s.companyId,
      company: companyCodeMap.get(s.companyId) ?? '',
      value:
        (s.data as { value?: number; rate?: number })?.value ??
        (s.data as { rate?: number })?.rate ??
        null,
    }))

    return apiSuccess({
      results,
      trend,
      kpi: kpiParam,
      year,
      kpis,
      kpiMeta: KPI_META,
      ...(yoyResults ? { yoyResults } : {}),
    })
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW)
)
