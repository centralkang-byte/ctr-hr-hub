// src/app/api/v1/dashboard/widgets/[widgetId]/route.ts
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Active assignment filter ──────────────────────────────

function activeAssignmentWhere(companyId: string | null) {
  return companyId
    ? { assignments: { some: { companyId, isPrimary: true, endDate: null, status: 'ACTIVE' } } }
    : { assignments: { some: { isPrimary: true, endDate: null, status: 'ACTIVE' } } }
}

// ─── Workforce tab ─────────────────────────────────────────

async function getWorkforceGrade(companyId: string | null) {
  const where = {
    isPrimary: true,
    endDate: null,
    status: 'ACTIVE',
    ...(companyId ? { companyId } : {}),
  }
  const rows = await prisma.employeeAssignment.groupBy({
    by: ['jobGradeId'],
    where,
    _count: { id: true },
  })
  const gradeIds = rows.map((r) => r.jobGradeId).filter(Boolean) as string[]
  const grades = await prisma.jobGrade.findMany({
    where: { id: { in: gradeIds } },
    select: { id: true, code: true, name: true },
  })
  const gradeMap = new Map(grades.map((g) => [g.id, g.code]))
  return rows.map((r) => ({
    grade: r.jobGradeId ? (gradeMap.get(r.jobGradeId) ?? r.jobGradeId) : '(없음)',
    count: r._count.id,
  }))
}

async function getWorkforceByCompany(companyId: string | null) {
  const where = {
    isPrimary: true,
    endDate: null,
    status: 'ACTIVE',
    ...(companyId ? { companyId } : {}),
  }
  const rows = await prisma.employeeAssignment.groupBy({
    by: ['companyId'],
    where,
    _count: { id: true },
  })
  const cIds = rows.map((r) => r.companyId)
  const companies = await prisma.company.findMany({
    where: { id: { in: cIds } },
    select: { id: true, code: true, name: true },
  })
  const companyMap = new Map(companies.map((c) => [c.id, c.code]))
  return rows.map((r) => ({
    company: companyMap.get(r.companyId) ?? r.companyId,
    count: r._count.id,
  }))
}

async function getWorkforceTrend(companyId: string | null) {
  const start = new Date()
  start.setMonth(start.getMonth() - 11)
  start.setDate(1)
  const snapshots = await prisma.analyticsSnapshot.findMany({
    where: {
      type: 'headcount',
      snapshotDate: { gte: start },
      ...(companyId ? { companyId } : {}),
    },
    orderBy: { snapshotDate: 'asc' },
    select: { snapshotDate: true, data: true, companyId: true },
  })
  return snapshots.map((s) => ({
    month: s.snapshotDate.toISOString().slice(0, 7),
    count: (s.data as { count?: number })?.count ?? 0,
    companyId: s.companyId,
  }))
}

async function getWorkforceTenure(companyId: string | null) {
  const employees = await prisma.employee.findMany({
    where: {
      deletedAt: null,
      ...activeAssignmentWhere(companyId),
    },
    select: { hireDate: true },
  })
  const now = new Date()
  const buckets = {
    '1년 미만': 0,
    '1-3년': 0,
    '3-5년': 0,
    '5-10년': 0,
    '10년 이상': 0,
  }
  for (const emp of employees) {
    const years = (now.getTime() - emp.hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    if (years < 1) buckets['1년 미만']++
    else if (years < 3) buckets['1-3년']++
    else if (years < 5) buckets['3-5년']++
    else if (years < 10) buckets['5-10년']++
    else buckets['10년 이상']++
  }
  return Object.entries(buckets).map(([range, count]) => ({ range, count }))
}

// ─── Recruit tab ───────────────────────────────────────────

async function getRecruitPipeline(companyId: string | null) {
  const rows = await prisma.application.groupBy({
    by: ['stage'],
    where: companyId
      ? { posting: { companyId } }
      : {},
    _count: { id: true },
  })
  return rows.map((r) => ({ stage: r.stage, count: r._count.id }))
}

async function getRecruitTTR(companyId: string | null) {
  const hired = await prisma.application.findMany({
    where: {
      stage: 'HIRED',
      ...(companyId ? { posting: { companyId } } : {}),
    },
    select: {
      appliedAt: true,
      updatedAt: true,
      posting: { select: { companyId: true } },
    },
    take: 500,
    orderBy: { updatedAt: 'desc' },
  })
  const byCompany = new Map<string, number[]>()
  for (const a of hired) {
    const cId = a.posting.companyId
    const days = Math.ceil((a.updatedAt.getTime() - a.appliedAt.getTime()) / (1000 * 60 * 60 * 24))
    if (!byCompany.has(cId)) byCompany.set(cId, [])
    byCompany.get(cId)!.push(days)
  }
  const cIds = [...byCompany.keys()]
  const companies = await prisma.company.findMany({
    where: { id: { in: cIds } },
    select: { id: true, code: true },
  })
  const companyMap = new Map(companies.map((c) => [c.id, c.code]))
  return cIds.map((cId) => {
    const days = byCompany.get(cId)!
    return {
      company: companyMap.get(cId) ?? cId,
      avgDays: Math.round(days.reduce((s, d) => s + d, 0) / days.length),
    }
  })
}

async function getTalentPool(_companyId: string | null) {
  try {
    const now = new Date()
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    // TalentPoolEntry does not have companyId — filter is omitted
    const [active, expiringSoon] = await Promise.all([
      prisma.talentPoolEntry.count({ where: { status: 'active' } }),
      prisma.talentPoolEntry.count({
        where: {
          status: 'active',
          expiresAt: { lte: thirtyDaysLater, gte: now },
        },
      }),
    ])
    return { active, expiringSoon }
  } catch {
    return { active: 0, expiringSoon: 0 }
  }
}

// ─── Performance tab ───────────────────────────────────────

async function getPerfGrade(companyId: string | null, year: number) {
  const rows = await prisma.performanceEvaluation.groupBy({
    by: ['performanceGrade'],
    where: {
      ...(companyId ? { companyId } : {}),
      cycle: { year },
      performanceGrade: { not: null },
    },
    _count: { id: true },
  })
  return rows.map((r) => ({ grade: r.performanceGrade ?? '(없음)', count: r._count.id }))
}

async function getSkillGapTop5(companyId: string | null) {
  // Use CompetencyRequirement.expectedLevel vs EmployeeSkillAssessment.finalLevel
  // Remove assessmentPeriod: 'latest' — get ALL assessments and deduplicate
  const assessments = await prisma.employeeSkillAssessment.findMany({
    where: {
      finalLevel: { not: null },
      ...(companyId ? { employee: activeAssignmentWhere(companyId) } : {}),
    },
    select: {
      employeeId: true,
      competencyId: true,
      finalLevel: true,
      createdAt: true,
      competency: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Deduplicate: keep latest per employeeId + competencyId
  const seen = new Set<string>()
  const deduped = assessments.filter((a) => {
    const key = `${a.employeeId}_${a.competencyId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Group by competency and compute average finalLevel
  const byCompetency = new Map<string, { name: string; levels: number[] }>()
  for (const a of deduped) {
    if (a.finalLevel === null) continue
    if (!byCompetency.has(a.competencyId)) {
      byCompetency.set(a.competencyId, { name: a.competency.name, levels: [] })
    }
    byCompetency.get(a.competencyId)!.levels.push(a.finalLevel)
  }

  // Get expected levels from CompetencyRequirement
  const competencyIds = [...byCompetency.keys()]
  const requirements = await prisma.competencyRequirement.findMany({
    where: {
      competencyId: { in: competencyIds },
      ...(companyId ? { companyId } : {}),
    },
    select: { competencyId: true, expectedLevel: true },
  })
  const expectedMap = new Map<string, number>()
  for (const r of requirements) {
    // take max expected level per competency
    const existing = expectedMap.get(r.competencyId) ?? 0
    if (r.expectedLevel > existing) expectedMap.set(r.competencyId, r.expectedLevel)
  }

  const gaps: Array<{ name: string; avgGap: number }> = []
  for (const [cId, { name, levels }] of byCompetency) {
    const expected = expectedMap.get(cId)
    if (expected === undefined) continue
    const avg = levels.reduce((s, l) => s + l, 0) / levels.length
    const avgGap = expected - avg
    if (avgGap > 0) gaps.push({ name, avgGap: Math.round(avgGap * 100) / 100 })
  }

  return gaps.sort((a, b) => b.avgGap - a.avgGap).slice(0, 5)
}

// ─── Attendance tab ────────────────────────────────────────

async function getAttend52h(companyId: string | null) {
  const rows = await prisma.workHourAlert.groupBy({
    by: ['alertLevel'],
    where: {
      isResolved: false,
      ...(companyId
        ? { employee: activeAssignmentWhere(companyId) }
        : {}),
    },
    _count: { id: true },
  })
  return rows.map((r) => ({ level: r.alertLevel, count: r._count.id }))
}

async function getAttendLeaveTrend(companyId: string | null, year: number) {
  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31, 23, 59, 59)
  const requests = await prisma.leaveRequest.findMany({
    where: {
      status: 'APPROVED',
      startDate: { gte: start, lte: end },
      ...(companyId ? { companyId } : {}),
    },
    select: { startDate: true },
  })
  const monthCounts: Record<string, number> = {}
  for (let m = 0; m < 12; m++) {
    monthCounts[`${year}-${String(m + 1).padStart(2, '0')}`] = 0
  }
  for (const req of requests) {
    const key = req.startDate.toISOString().slice(0, 7)
    if (key in monthCounts) monthCounts[key]++
  }
  return Object.entries(monthCounts).map(([month, count]) => ({ month, count }))
}

async function getBurnoutRisk(companyId: string | null) {
  // Get latest burnout score per employee
  const scores = await prisma.burnoutScore.findMany({
    where: companyId
      ? { employee: activeAssignmentWhere(companyId) }
      : {},
    distinct: ['employeeId'],
    orderBy: { calculatedAt: 'desc' },
    select: { riskLevel: true },
  })
  const levelCounts: Record<string, number> = {}
  for (const s of scores) {
    levelCounts[s.riskLevel] = (levelCounts[s.riskLevel] ?? 0) + 1
  }
  return Object.entries(levelCounts).map(([level, count]) => ({ level, count }))
}

// ─── Payroll tab ───────────────────────────────────────────

async function getPayrollCost(companyId: string | null, year: number) {
  const runs = await prisma.payrollRun.findMany({
    where: {
      yearMonth: { startsWith: String(year) },
      status: { in: ['APPROVED', 'PAID'] },
      ...(companyId ? { companyId } : {}),
    },
    select: {
      companyId: true,
      currency: true,
      payrollItems: { select: { grossPay: true, currency: true } },
    },
  })

  // Group by company
  const byCompany = new Map<string, { currency: string; totalLocal: number }>()
  for (const run of runs) {
    if (!byCompany.has(run.companyId)) {
      byCompany.set(run.companyId, { currency: run.currency, totalLocal: 0 })
    }
    const entry = byCompany.get(run.companyId)!
    for (const item of run.payrollItems) {
      entry.totalLocal += Number(item.grossPay)
    }
  }

  // Fetch exchange rates for this year (use latest month available)
  const currencies = [...new Set([...byCompany.values()].map((e) => e.currency))]
  const rates = await prisma.exchangeRate.findMany({
    where: {
      year,
      fromCurrency: { in: currencies },
      toCurrency: 'KRW',
    },
    orderBy: { month: 'desc' },
    select: { fromCurrency: true, rate: true, month: true },
  })
  // Build rate map: fromCurrency -> rate (latest month)
  const rateMap = new Map<string, number>()
  for (const r of rates) {
    if (!rateMap.has(r.fromCurrency)) rateMap.set(r.fromCurrency, Number(r.rate))
  }

  const cIds = [...byCompany.keys()]
  const companies = await prisma.company.findMany({
    where: { id: { in: cIds } },
    select: { id: true, code: true },
  })
  const companyMap = new Map(companies.map((c) => [c.id, c.code]))

  return cIds.map((cId) => {
    const { currency, totalLocal } = byCompany.get(cId)!
    const rate = currency === 'KRW' ? 1 : (rateMap.get(currency) ?? null)
    return {
      company: companyMap.get(cId) ?? cId,
      currency,
      totalLocal: Math.round(totalLocal),
      totalKrw: rate !== null ? Math.round(totalLocal * rate) : null,
    }
  })
}

// ─── Training/Benefit tab ──────────────────────────────────

async function getTrainingMandatory(companyId: string | null, year: number) {
  const configs = await prisma.mandatoryTrainingConfig.findMany({
    where: { deletedAt: null },
    include: { course: { select: { id: true, title: true } } },
  })
  if (configs.length === 0) return []

  const courseIds = configs.map((c) => c.courseId)
  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31, 23, 59, 59)
  const empFilter = companyId ? activeAssignmentWhere(companyId) : {}

  // Batch: count total and completed in 2 queries instead of 2N
  const [totals, completeds] = await Promise.all([
    prisma.trainingEnrollment.groupBy({
      by: ['courseId'],
      where: {
        courseId: { in: courseIds },
        source: 'mandatory_auto',
        enrolledAt: { gte: start, lte: end },
        ...(companyId ? { employee: empFilter } : {}),
      },
      _count: { _all: true },
    }),
    prisma.trainingEnrollment.groupBy({
      by: ['courseId'],
      where: {
        courseId: { in: courseIds },
        source: 'mandatory_auto',
        status: 'ENROLLMENT_COMPLETED',
        enrolledAt: { gte: start, lte: end },
        ...(companyId ? { employee: empFilter } : {}),
      },
      _count: { _all: true },
    }),
  ])

  const totalMap = new Map(totals.map((t) => [t.courseId, t._count._all]))
  const completedMap = new Map(completeds.map((t) => [t.courseId, t._count._all]))

  return configs.map((config) => {
    const total = totalMap.get(config.courseId) ?? 0
    const completed = completedMap.get(config.courseId) ?? 0
    return {
      courseTitle: config.course.title,
      total,
      completed,
      rate: total > 0 ? Math.round((completed / total) * 1000) / 10 : null,
    }
  })
}

async function getBenefitUsage(companyId: string | null, year: number) {
  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31, 23, 59, 59)

  const claims = await prisma.benefitClaim.findMany({
    where: {
      status: 'approved',
      createdAt: { gte: start, lte: end },
      ...(companyId
        ? { employee: activeAssignmentWhere(companyId) }
        : {}),
    },
    select: {
      claimAmount: true,
      approvedAmount: true,
      benefitPlan: { select: { category: true } },
    },
  })

  const byCategory = new Map<string, { count: number; totalAmount: number }>()
  for (const claim of claims) {
    const category = claim.benefitPlan.category
    if (!byCategory.has(category)) byCategory.set(category, { count: 0, totalAmount: 0 })
    const entry = byCategory.get(category)!
    entry.count++
    entry.totalAmount += claim.approvedAmount ?? claim.claimAmount
  }

  return [...byCategory.entries()].map(([category, { count, totalAmount }]) => ({
    category,
    count,
    totalAmount,
  }))
}

// ─── Handler map ───────────────────────────────────────────

const WIDGET_HANDLERS: Record<
  string,
  (companyId: string | null, year: number) => Promise<unknown>
> = {
  'workforce-grade': (c) => getWorkforceGrade(c),
  'workforce-company': (c) => getWorkforceByCompany(c),
  'workforce-trend': (c) => getWorkforceTrend(c),
  'workforce-tenure': (c) => getWorkforceTenure(c),
  'recruit-pipeline': (c) => getRecruitPipeline(c),
  'recruit-ttr': (c) => getRecruitTTR(c),
  'recruit-talent-pool': (c) => getTalentPool(c),
  'perf-grade': (c, y) => getPerfGrade(c, y),
  'perf-skill-gap': (c) => getSkillGapTop5(c),
  'attend-52h': (c) => getAttend52h(c),
  'attend-leave-trend': (c, y) => getAttendLeaveTrend(c, y),
  'attend-burnout': (c) => getBurnoutRisk(c),
  'payroll-cost': (c, y) => getPayrollCost(c, y),
  'training-mandatory': (c, y) => getTrainingMandatory(c, y),
  'training-benefit': (c, y) => getBenefitUsage(c, y),
}

// ─── Route export ──────────────────────────────────────────

export const GET = withPermission(
  async (
    req: NextRequest,
    ctx: { params: Promise<Record<string, string>> },
    user: SessionUser
  ) => {
    const { widgetId } = await ctx.params
    const { searchParams } = new URL(req.url)
    const parsedYear = parseInt(searchParams.get('year') ?? '', 10)
    const year = !isNaN(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
      ? parsedYear
      : new Date().getFullYear()
    const requestedCompanyId = searchParams.get('companyId')
    const isGlobalRole =
      user.role === ROLE.SUPER_ADMIN || (user.role === ROLE.HR_ADMIN && !user.companyId)
    const companyId: string | null =
      requestedCompanyId === 'all' || (!requestedCompanyId && isGlobalRole)
        ? null
        : isGlobalRole
        ? (requestedCompanyId ?? null)
        : (user.companyId ?? null)

    const handler = WIDGET_HANDLERS[widgetId]
    if (!handler) throw badRequest(`Unknown widgetId: ${widgetId}`)

    try {
      const data = await handler(companyId, year)
      return apiSuccess(data)
    } catch (error) {
      console.warn(`Widget ${widgetId} failed:`, error)
      return apiSuccess(null)
    }
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW)
)
