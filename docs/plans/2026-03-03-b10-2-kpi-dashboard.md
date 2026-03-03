# B10-2 HR KPI 대시보드 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** HR 리더와 경영진이 한눈에 조직 건강도를 파악할 수 있는 KPI 대시보드 구축 (`/dashboard` + `/dashboard/compare`)

**Architecture:** 클라이언트 완전 독립 위젯 방식 — 각 위젯이 독립적으로 API 호출하며 한 위젯 실패가 다른 위젯에 영향 없음. 탭별 lazy mount로 초기 로드 최소화.

**Tech Stack:** Next.js App Router, Prisma ORM, Tailwind CSS, Recharts, TypeScript

---

## 사전 확인 사항

```bash
# 작업 디렉토리
cd /Users/sangwoo/Documents/VibeCoding/GHR/ctr-hr-hub

# B 트랙 migrate 완료 여부 확인 후 진행
npx prisma migrate status
```

---

## Task 1: DB 마이그레이션

**Files:**
- Modify: `prisma/schema.prisma` (마지막 부분에 모델 추가)

**Step 1: schema.prisma에 KpiDashboardConfig 추가**

파일 끝 부분 (AnalyticsConfig 모델 아래) 에 추가:

```prisma
// ═══════════════════════════════════════════════════════════
// === TRACK A: B10-2 KPI Dashboard ===
// ═══════════════════════════════════════════════════════════

model KpiDashboardConfig {
  id        String   @id @default(uuid())
  userId    String
  layout    Json
  filters   Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId])
  @@map("kpi_dashboard_configs")
}
```

⚠️ `@db.Uuid` 절대 사용 금지 — 프로젝트 전체 컨벤션

**Step 2: 마이그레이션 실행**

```bash
npx prisma migrate dev --name a_kpi_dashboard
```

Expected: `Your database is now in sync with your schema.`

**Step 3: Prisma Client 재생성 확인**

```bash
npx prisma generate
```

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add KpiDashboardConfig model (a_kpi_dashboard)"
```

---

## Task 2: Dashboard Summary API (6개 핵심 KPI)

**Files:**
- Create: `src/app/api/v1/dashboard/summary/route.ts`

**Step 1: 파일 생성**

```typescript
// src/app/api/v1/dashboard/summary/route.ts
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── 헬퍼: 현재 활성 직원 쿼리 조건 ───────────────────────
function activeAssignmentWhere(companyId: string | null) {
  return companyId
    ? {
        assignments: {
          some: { companyId, isPrimary: true, endDate: null, status: 'ACTIVE' },
        },
      }
    : {
        assignments: {
          some: { isPrimary: true, endDate: null, status: 'ACTIVE' },
        },
      }
}

// ─── 총 인원 ───────────────────────────────────────────────
async function countActiveEmployees(companyId: string | null) {
  // 현재월 기준
  const now = new Date()
  const count = await prisma.employeeAssignment.count({
    where: {
      isPrimary: true,
      endDate: null,
      status: 'ACTIVE',
      ...(companyId ? { companyId } : {}),
    },
  })
  // 전월 스냅샷에서 비교값 가져오기
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  let prevCount: number | null = null
  if (companyId) {
    const snap = await prisma.analyticsSnapshot.findFirst({
      where: {
        companyId,
        type: 'headcount',
        snapshotDate: { gte: lastMonth, lt: new Date(now.getFullYear(), now.getMonth(), 1) },
      },
      orderBy: { snapshotDate: 'desc' },
    })
    if (snap) {
      prevCount = (snap.data as { count?: number })?.count ?? null
    }
  }
  return { count, prevCount, change: prevCount !== null ? count - prevCount : null }
}

// ─── 이직률 (최근 12개월) ─────────────────────────────────
async function calcTurnoverRate(companyId: string | null, year: number) {
  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31, 23, 59, 59)
  // 퇴직 처리된 assignment 수
  const terminated = await prisma.employeeAssignment.count({
    where: {
      isPrimary: true,
      status: 'TERMINATED',
      endDate: { gte: start, lte: end },
      ...(companyId ? { companyId } : {}),
    },
  })
  // 연초 기준 인원
  const baseCount = await prisma.employeeAssignment.count({
    where: {
      isPrimary: true,
      status: 'ACTIVE',
      startDate: { lte: start },
      OR: [{ endDate: null }, { endDate: { gt: start } }],
      ...(companyId ? { companyId } : {}),
    },
  })
  if (baseCount === 0) return { rate: null, change: null }
  const rate = Math.round((terminated / baseCount) * 1000) / 10 // 소수점 1자리
  return { rate, change: null } // 전월 비교는 스냅샷 없으면 null
}

// ─── 채용 진행 건수 ────────────────────────────────────────
async function countOpenRequisitions(companyId: string | null) {
  try {
    const count = await prisma.requisition.count({
      where: {
        status: 'approved',
        ...(companyId ? { companyId } : {}),
      },
    })
    // 평균 소요일: HIRED 된 application 기준
    const hired = await prisma.application.findMany({
      where: {
        stage: 'HIRED',
        posting: companyId
          ? { requisition: { companyId } }
          : undefined,
      },
      select: { appliedAt: true, updatedAt: true },
      take: 100,
      orderBy: { updatedAt: 'desc' },
    })
    const avgDays =
      hired.length > 0
        ? Math.round(
            hired.reduce((sum, a) => {
              const days = Math.ceil(
                (a.updatedAt.getTime() - a.appliedAt.getTime()) / (1000 * 60 * 60 * 24)
              )
              return sum + days
            }, 0) / hired.length
          )
        : null
    return { count, avgDays }
  } catch {
    return null
  }
}

// ─── 이직 위험 (High + Critical) ─────────────────────────
async function countHighRiskEmployees(companyId: string | null) {
  try {
    // 직원별 최신 점수만 (subquery 대신 employeeId로 group)
    const scores = await prisma.turnoverRiskScore.findMany({
      where: {
        riskLevel: { in: ['high', 'critical'] },
        employee: companyId ? activeAssignmentWhere(companyId) : undefined,
      },
      distinct: ['employeeId'],
      orderBy: { calculatedAt: 'desc' },
      select: { employeeId: true, riskLevel: true },
    })
    return { count: scores.length, high: scores.filter((s) => s.riskLevel === 'high').length, critical: scores.filter((s) => s.riskLevel === 'critical').length }
  } catch {
    return null
  }
}

// ─── 연차 사용률 ───────────────────────────────────────────
async function calcAvgLeaveUsage(companyId: string | null, year: number) {
  try {
    // LeaveYearBalance 테이블 사용 (B6-2에서 생성)
    const balances = await prisma.leaveYearBalance.findMany({
      where: {
        year,
        employee: companyId ? activeAssignmentWhere(companyId) : undefined,
        entitled: { gt: 0 },
      },
      select: { entitled: true, used: true },
    })
    if (balances.length === 0) return null
    const avgUsage =
      balances.reduce((sum, b) => sum + (b.entitled > 0 ? b.used / b.entitled : 0), 0) /
      balances.length
    return { rate: Math.round(avgUsage * 1000) / 10 } // %
  } catch {
    // fallback: EmployeeLeaveBalance
    try {
      const balances = await prisma.employeeLeaveBalance.findMany({
        where: {
          employee: companyId ? activeAssignmentWhere(companyId) : undefined,
        },
        select: { grantedDays: true, usedDays: true },
      })
      if (balances.length === 0) return null
      const avgUsage =
        balances.reduce((sum, b) => {
          const granted = Number(b.grantedDays)
          const used = Number(b.usedDays)
          return sum + (granted > 0 ? used / granted : 0)
        }, 0) / balances.length
      return { rate: Math.round(avgUsage * 1000) / 10 }
    } catch {
      return null
    }
  }
}

// ─── 교육 이수율 ───────────────────────────────────────────
async function calcTrainingCompletionRate(companyId: string | null, year: number) {
  try {
    const start = new Date(year, 0, 1)
    const end = new Date(year, 11, 31, 23, 59, 59)
    const [total, completed] = await Promise.all([
      prisma.trainingEnrollment.count({
        where: {
          enrolledAt: { gte: start, lte: end },
          employee: companyId ? activeAssignmentWhere(companyId) : undefined,
        },
      }),
      prisma.trainingEnrollment.count({
        where: {
          status: 'COMPLETED',
          enrolledAt: { gte: start, lte: end },
          employee: companyId ? activeAssignmentWhere(companyId) : undefined,
        },
      }),
    ])
    if (total === 0) return null
    return { rate: Math.round((completed / total) * 1000) / 10, completed, total }
  } catch {
    return null
  }
}

// ─── GET handler ──────────────────────────────────────────
export const GET = withPermission(
  async (req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const year = Number(searchParams.get('year') ?? new Date().getFullYear())

    // 법인 필터 결정
    const requestedCompanyId = searchParams.get('companyId')
    const isGlobalRole =
      user.role === ROLE.SUPER_ADMIN ||
      user.role === ROLE.HR_ADMIN && !user.companyId
    const companyId: string | null =
      requestedCompanyId === 'all' || (!requestedCompanyId && isGlobalRole)
        ? null
        : requestedCompanyId ?? user.companyId ?? null

    const [headcount, turnover, openPositions, riskCount, leaveUsage, trainingRate] =
      await Promise.allSettled([
        countActiveEmployees(companyId),
        calcTurnoverRate(companyId, year),
        countOpenRequisitions(companyId),
        countHighRiskEmployees(companyId),
        calcAvgLeaveUsage(companyId, year),
        calcTrainingCompletionRate(companyId, year),
      ])

    return apiSuccess({
      headcount: headcount.status === 'fulfilled' ? headcount.value : null,
      turnoverRate: turnover.status === 'fulfilled' ? turnover.value : null,
      openPositions: openPositions.status === 'fulfilled' ? openPositions.value : null,
      attritionRisk: riskCount.status === 'fulfilled' ? riskCount.value : null,
      leaveUsage: leaveUsage.status === 'fulfilled' ? leaveUsage.value : null,
      trainingCompletion: trainingRate.status === 'fulfilled' ? trainingRate.value : null,
      meta: { year, companyId },
    })
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW)
)
```

**Step 2: TypeScript 검증**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors (또는 이 파일 관련 오류만 수정)

**Step 3: Commit**

```bash
git add src/app/api/v1/dashboard/summary/route.ts
git commit -m "feat: add dashboard summary API with 6 core KPIs"
```

---

## Task 3: Widget 데이터 API (탭별)

**Files:**
- Create: `src/app/api/v1/dashboard/widgets/[widgetId]/route.ts`

**Step 1: 파일 생성**

```typescript
// src/app/api/v1/dashboard/widgets/[widgetId]/route.ts
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

function getCompanyWhere(companyId: string | null) {
  return companyId ? { companyId } : {}
}

function activeAssignmentWhere(companyId: string | null) {
  return companyId
    ? { assignments: { some: { companyId, isPrimary: true, endDate: null, status: 'ACTIVE' } } }
    : { assignments: { some: { isPrimary: true, endDate: null, status: 'ACTIVE' } } }
}

// ─── 인력 탭 위젯 ─────────────────────────────────────────

async function getWorkforceGrade(companyId: string | null) {
  const assignments = await prisma.employeeAssignment.groupBy({
    by: ['jobGradeId'],
    where: {
      isPrimary: true,
      endDate: null,
      status: 'ACTIVE',
      jobGradeId: { not: null },
      ...(companyId ? { companyId } : {}),
    },
    _count: { _all: true },
  })
  const grades = await prisma.jobGrade.findMany({ select: { id: true, code: true, name: true } })
  const gradeMap = new Map(grades.map((g) => [g.id, g]))
  return assignments
    .map((a) => ({ grade: gradeMap.get(a.jobGradeId!)?.code ?? '미분류', count: a._count._all }))
    .sort((a, b) => a.grade.localeCompare(b.grade))
}

async function getWorkforceByCompany(companyId: string | null) {
  const assignments = await prisma.employeeAssignment.groupBy({
    by: ['companyId'],
    where: {
      isPrimary: true,
      endDate: null,
      status: 'ACTIVE',
      ...(companyId ? { companyId } : {}),
    },
    _count: { _all: true },
  })
  const companies = await prisma.company.findMany({ select: { id: true, code: true, name: true } })
  const compMap = new Map(companies.map((c) => [c.id, c]))
  return assignments.map((a) => ({
    company: compMap.get(a.companyId)?.code ?? a.companyId,
    count: a._count._all,
  }))
}

async function getWorkforceTrend() {
  // 최근 12개월 스냅샷에서 headcount 추이
  const start = new Date()
  start.setMonth(start.getMonth() - 11)
  start.setDate(1)
  const snapshots = await prisma.analyticsSnapshot.findMany({
    where: { type: 'headcount', snapshotDate: { gte: start } },
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
  const assignments = await prisma.employeeAssignment.findMany({
    where: { isPrimary: true, endDate: null, status: 'ACTIVE', ...(companyId ? { companyId } : {}) },
    include: { employee: { select: { hireDate: true } } },
    select: { employee: { select: { hireDate: true } } },
  })
  const now = new Date()
  const buckets = { '1년 미만': 0, '1-3년': 0, '3-5년': 0, '5-10년': 0, '10년 이상': 0 }
  for (const a of assignments) {
    if (!a.employee.hireDate) continue
    const years = (now.getTime() - new Date(a.employee.hireDate).getTime()) / (1000 * 60 * 60 * 24 * 365)
    if (years < 1) buckets['1년 미만']++
    else if (years < 3) buckets['1-3년']++
    else if (years < 5) buckets['3-5년']++
    else if (years < 10) buckets['5-10년']++
    else buckets['10년 이상']++
  }
  return Object.entries(buckets).map(([range, count]) => ({ range, count }))
}

// ─── 채용 탭 위젯 ─────────────────────────────────────────

async function getRecruitPipeline(companyId: string | null) {
  const stages = ['APPLIED', 'SCREENING', 'INTERVIEW', 'FINAL', 'OFFERED', 'HIRED']
  const results = await Promise.all(
    stages.map((stage) =>
      prisma.application.count({
        where: {
          stage: stage as never,
          posting: companyId ? { requisition: { companyId } } : undefined,
        },
      }).then((count) => ({ stage, count }))
    )
  )
  return results
}

async function getRecruitTTR(companyId: string | null) {
  const companies = companyId
    ? await prisma.company.findMany({ where: { id: companyId }, select: { id: true, code: true } })
    : await prisma.company.findMany({ select: { id: true, code: true } })

  return Promise.all(
    companies.map(async (c) => {
      const hired = await prisma.application.findMany({
        where: { stage: 'HIRED', posting: { requisition: { companyId: c.id } } },
        select: { appliedAt: true, updatedAt: true },
        take: 50,
        orderBy: { updatedAt: 'desc' },
      })
      const avgDays =
        hired.length > 0
          ? Math.round(
              hired.reduce((sum, a) => sum + Math.ceil((a.updatedAt.getTime() - a.appliedAt.getTime()) / 86400000), 0) /
                hired.length
            )
          : null
      return { company: c.code, avgDays }
    })
  )
}

async function getTalentPool(companyId: string | null) {
  const [active, expiringSoon] = await Promise.all([
    prisma.talentPool.count({ where: { status: 'ACTIVE', ...(companyId ? { companyId } : {}) } }),
    prisma.talentPool.count({
      where: {
        status: 'ACTIVE',
        expiresAt: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        ...(companyId ? { companyId } : {}),
      },
    }),
  ])
  return { active, expiringSoon }
}

// ─── 성과 탭 위젯 ─────────────────────────────────────────

async function getPerfGrade(companyId: string | null, year: number) {
  const evals = await prisma.performanceEvaluation.groupBy({
    by: ['performanceGrade', 'companyId'],
    where: {
      reviewPeriod: year.toString(),
      status: 'COMPLETED',
      ...(companyId ? { companyId } : {}),
    },
    _count: { _all: true },
  })
  return evals.map((e) => ({
    grade: e.performanceGrade ?? '미분류',
    companyId: e.companyId,
    count: e._count._all,
  }))
}

async function getSkillGapTop5(companyId: string | null) {
  const assessments = await prisma.employeeSkillAssessment.findMany({
    where: {
      expectedLevel: { not: null },
      employee: companyId ? activeAssignmentWhere(companyId) : undefined,
    },
    include: { competency: { select: { id: true, name: true } } },
    select: {
      competencyId: true,
      finalLevel: true,
      expectedLevel: true,
      competency: { select: { name: true } },
    },
  })
  // competencyId별 평균 gap 계산
  const gapMap = new Map<string, { name: string; totalGap: number; count: number }>()
  for (const a of assessments) {
    if (a.expectedLevel === null || a.finalLevel === null) continue
    const gap = a.expectedLevel - a.finalLevel
    const existing = gapMap.get(a.competencyId)
    if (existing) {
      existing.totalGap += gap
      existing.count++
    } else {
      gapMap.set(a.competencyId, { name: a.competency.name, totalGap: gap, count: 1 })
    }
  }
  return Array.from(gapMap.entries())
    .map(([id, v]) => ({ competencyId: id, name: v.name, avgGap: Math.round((v.totalGap / v.count) * 10) / 10 }))
    .filter((v) => v.avgGap > 0)
    .sort((a, b) => b.avgGap - a.avgGap)
    .slice(0, 5)
}

// ─── 근태 탭 위젯 ─────────────────────────────────────────

async function getAttend52h(companyId: string | null) {
  const alerts = await prisma.workHourAlert.groupBy({
    by: ['alertLevel'],
    where: {
      isResolved: false,
      employee: companyId ? activeAssignmentWhere(companyId) : undefined,
    },
    _count: { _all: true },
  })
  return alerts.map((a) => ({ level: a.alertLevel, count: a._count._all }))
}

async function getAttendLeaveTrend(companyId: string | null, year: number) {
  // 월별 연차 사용 건수
  const results = []
  for (let m = 0; m < 12; m++) {
    const start = new Date(year, m, 1)
    const end = new Date(year, m + 1, 0, 23, 59, 59)
    const count = await prisma.leaveRequest.count({
      where: {
        status: 'APPROVED',
        startDate: { gte: start, lte: end },
        employee: companyId ? activeAssignmentWhere(companyId) : undefined,
      },
    })
    results.push({ month: `${year}-${String(m + 1).padStart(2, '0')}`, count })
  }
  return results
}

async function getBurnoutRisk(companyId: string | null) {
  const scores = await prisma.burnoutScore.findMany({
    where: {
      employee: companyId ? activeAssignmentWhere(companyId) : undefined,
    },
    distinct: ['employeeId'],
    orderBy: { calculatedAt: 'desc' },
    select: { riskLevel: true },
  })
  const grouped: Record<string, number> = {}
  for (const s of scores) {
    grouped[s.riskLevel] = (grouped[s.riskLevel] ?? 0) + 1
  }
  return Object.entries(grouped).map(([level, count]) => ({ level, count }))
}

// ─── 급여 탭 위젯 ─────────────────────────────────────────

async function getPayrollCost(companyId: string | null, year: number) {
  const companies = companyId
    ? await prisma.company.findMany({ where: { id: companyId }, select: { id: true, code: true, currency: true } })
    : await prisma.company.findMany({ select: { id: true, code: true, currency: true } })

  return Promise.all(
    companies.map(async (c) => {
      const runs = await prisma.payrollRun.findMany({
        where: {
          companyId: c.id,
          yearMonth: { startsWith: year.toString() },
          status: { in: ['APPROVED', 'PAID'] },
        },
        include: { items: { select: { grossPay: true } } },
      })
      const totalLocal = runs.reduce(
        (sum, r) => sum + r.items.reduce((s, i) => s + Number(i.grossPay), 0),
        0
      )
      // 환율 조회
      let exchangeRate = 1
      if (c.currency && c.currency !== 'KRW') {
        const rate = await prisma.exchangeRate.findFirst({
          where: { fromCurrency: c.currency, toCurrency: 'KRW', year },
          orderBy: { month: 'desc' },
        })
        exchangeRate = rate ? Number(rate.rate) : 1
      }
      return { company: c.code, currency: c.currency ?? 'KRW', totalLocal, totalKrw: Math.round(totalLocal * exchangeRate) }
    })
  )
}

// ─── 교육 탭 위젯 ─────────────────────────────────────────

async function getTrainingMandatory(companyId: string | null, year: number) {
  const configs = await prisma.mandatoryTrainingConfig.findMany({
    where: { isActive: true },
    include: { course: { select: { id: true, title: true } } },
  })
  return Promise.all(
    configs.map(async (config) => {
      const total = await prisma.trainingEnrollment.count({
        where: {
          courseId: config.courseId,
          source: 'mandatory_auto',
          enrolledAt: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31) },
          employee: companyId ? activeAssignmentWhere(companyId) : undefined,
        },
      })
      const completed = await prisma.trainingEnrollment.count({
        where: {
          courseId: config.courseId,
          source: 'mandatory_auto',
          status: 'COMPLETED',
          enrolledAt: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31) },
          employee: companyId ? activeAssignmentWhere(companyId) : undefined,
        },
      })
      return {
        courseTitle: config.course.title,
        total,
        completed,
        rate: total > 0 ? Math.round((completed / total) * 1000) / 10 : null,
      }
    })
  )
}

async function getBenefitUsage(companyId: string | null, year: number) {
  const claims = await prisma.benefitClaim.groupBy({
    by: ['benefitPlanId'],
    where: {
      status: 'approved',
      createdAt: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31) },
      employee: companyId ? activeAssignmentWhere(companyId) : undefined,
    },
    _count: { _all: true },
    _sum: { claimAmount: true },
  })
  const plans = await prisma.benefitPlan.findMany({ select: { id: true, name: true, category: true } })
  const planMap = new Map(plans.map((p) => [p.id, p]))
  return claims.map((c) => ({
    category: planMap.get(c.benefitPlanId)?.category ?? '기타',
    name: planMap.get(c.benefitPlanId)?.name ?? c.benefitPlanId,
    count: c._count._all,
    totalAmount: c._sum.claimAmount ?? 0,
  }))
}

// ─── 위젯 라우터 ──────────────────────────────────────────

const WIDGET_HANDLERS: Record<string, (companyId: string | null, year: number) => Promise<unknown>> = {
  'workforce-grade': (c) => getWorkforceGrade(c),
  'workforce-company': (c) => getWorkforceByCompany(c),
  'workforce-trend': () => getWorkforceTrend(),
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

export const GET = withPermission(
  async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { widgetId } = await ctx.params
    const { searchParams } = new URL(req.url)
    const year = Number(searchParams.get('year') ?? new Date().getFullYear())
    const requestedCompanyId = searchParams.get('companyId')
    const companyId: string | null =
      requestedCompanyId === 'all' ? null : requestedCompanyId ?? user.companyId ?? null

    const handler = WIDGET_HANDLERS[widgetId]
    if (!handler) throw badRequest(`Unknown widgetId: ${widgetId}`)

    try {
      const data = await handler(companyId, year)
      return apiSuccess(data)
    } catch (error) {
      // 위젯별 독립 실패 — 빈 데이터 반환
      console.warn(`Widget ${widgetId} failed:`, error)
      return apiSuccess(null)
    }
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW)
)
```

**Step 2: TypeScript 검증**

```bash
npx tsc --noEmit 2>&1 | grep "dashboard/widgets" | head -20
```

Expected: 0 errors 또는 구체적 에러 수정

**Step 3: Commit**

```bash
git add src/app/api/v1/dashboard/widgets/
git commit -m "feat: add widget data API for 15 dashboard widgets"
```

---

## Task 4: Compare API

**Files:**
- Create: `src/app/api/v1/dashboard/compare/route.ts`

**Step 1: 파일 생성**

```typescript
// src/app/api/v1/dashboard/compare/route.ts
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

type KpiKey = 'turnover_rate' | 'leave_usage' | 'training_completion' | 'avg_salary' | 'recruit_ttr' | 'payroll_cost'

async function calcKpiValue(kpi: KpiKey, companyId: string, year: number): Promise<number | null> {
  try {
    switch (kpi) {
      case 'turnover_rate': {
        const start = new Date(year, 0, 1)
        const end = new Date(year, 11, 31)
        const [terminated, base] = await Promise.all([
          prisma.employeeAssignment.count({ where: { companyId, isPrimary: true, status: 'TERMINATED', endDate: { gte: start, lte: end } } }),
          prisma.employeeAssignment.count({ where: { companyId, isPrimary: true, startDate: { lte: start }, OR: [{ endDate: null }, { endDate: { gt: start } }] } }),
        ])
        return base > 0 ? Math.round((terminated / base) * 1000) / 10 : null
      }
      case 'leave_usage': {
        const balances = await prisma.leaveYearBalance.findMany({
          where: { year, employee: { assignments: { some: { companyId, isPrimary: true, endDate: null } } }, entitled: { gt: 0 } },
          select: { entitled: true, used: true },
        })
        if (balances.length === 0) return null
        const avg = balances.reduce((s, b) => s + b.used / b.entitled, 0) / balances.length
        return Math.round(avg * 1000) / 10
      }
      case 'training_completion': {
        const [total, done] = await Promise.all([
          prisma.trainingEnrollment.count({ where: { enrolledAt: { gte: new Date(year, 0, 1) }, employee: { assignments: { some: { companyId, isPrimary: true } } } } }),
          prisma.trainingEnrollment.count({ where: { status: 'COMPLETED', enrolledAt: { gte: new Date(year, 0, 1) }, employee: { assignments: { some: { companyId, isPrimary: true } } } } }),
        ])
        return total > 0 ? Math.round((done / total) * 1000) / 10 : null
      }
      case 'payroll_cost': {
        const runs = await prisma.payrollRun.findMany({
          where: { companyId, yearMonth: { startsWith: year.toString() }, status: { in: ['APPROVED', 'PAID'] } },
          include: { items: { select: { grossPay: true } } },
        })
        const totalLocal = runs.reduce((s, r) => s + r.items.reduce((ss, i) => ss + Number(i.grossPay), 0), 0)
        const company = await prisma.company.findUnique({ where: { id: companyId }, select: { currency: true } })
        let rate = 1
        if (company?.currency && company.currency !== 'KRW') {
          const er = await prisma.exchangeRate.findFirst({ where: { fromCurrency: company.currency, toCurrency: 'KRW', year }, orderBy: { month: 'desc' } })
          rate = er ? Number(er.rate) : 1
        }
        return Math.round(totalLocal * rate / 1000000) // 백만 원 단위
      }
      default:
        return null
    }
  } catch {
    return null
  }
}

export const GET = withPermission(
  async (req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, _user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const kpi = (searchParams.get('kpi') ?? 'turnover_rate') as KpiKey
    const year = Number(searchParams.get('year') ?? new Date().getFullYear())

    const companies = await prisma.company.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } })

    const results = await Promise.all(
      companies.map(async (c) => ({
        companyId: c.id,
        company: c.code,
        name: c.name,
        value: await calcKpiValue(kpi, c.id, year),
      }))
    )

    // 12개월 추이 (AnalyticsSnapshot 활용)
    const trendStart = new Date(year, 0, 1)
    const snapshots = await prisma.analyticsSnapshot.findMany({
      where: { type: kpi, snapshotDate: { gte: trendStart } },
      orderBy: { snapshotDate: 'asc' },
      select: { companyId: true, snapshotDate: true, data: true },
    })

    return apiSuccess({ results, trend: snapshots, kpi, year })
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW)
)
```

**Step 2: TypeScript 검증 + Commit**

```bash
npx tsc --noEmit 2>&1 | grep "dashboard/compare" | head -10
git add src/app/api/v1/dashboard/compare/route.ts
git commit -m "feat: add dashboard global compare API"
```

---

## Task 5: 공유 컴포넌트

**Files:**
- Create: `src/components/dashboard/WidgetSkeleton.tsx`
- Create: `src/components/dashboard/WidgetEmpty.tsx`
- Create: `src/components/dashboard/KpiSummaryCard.tsx`
- Create: `src/components/dashboard/KpiWidget.tsx`

**Step 1: WidgetSkeleton**

```typescript
// src/components/dashboard/WidgetSkeleton.tsx
'use client'

export function WidgetSkeleton({ height = 'h-48' }: { height?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-[#E8E8E8] p-5 ${height} animate-pulse`}>
      <div className="h-4 bg-[#F5F5F5] rounded w-1/3 mb-4" />
      <div className="space-y-2">
        <div className="h-3 bg-[#F5F5F5] rounded w-full" />
        <div className="h-3 bg-[#F5F5F5] rounded w-4/5" />
        <div className="h-3 bg-[#F5F5F5] rounded w-3/5" />
      </div>
    </div>
  )
}
```

**Step 2: WidgetEmpty**

```typescript
// src/components/dashboard/WidgetEmpty.tsx
'use client'

interface WidgetEmptyProps {
  title: string
  message?: string
}

export function WidgetEmpty({ title, message = '데이터가 없습니다' }: WidgetEmptyProps) {
  return (
    <div className="bg-white rounded-xl border border-[#E8E8E8] p-5">
      <p className="text-xs text-[#666] mb-3">{title}</p>
      <div className="flex items-center justify-center h-32 text-sm text-[#999]">
        {message}
      </div>
    </div>
  )
}
```

**Step 3: KpiSummaryCard**

```typescript
// src/components/dashboard/KpiSummaryCard.tsx
'use client'

import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'

interface KpiSummaryCardProps {
  label: string
  value: string | number | null
  unit?: string
  change?: number | null
  changeLabel?: string
  status?: 'default' | 'danger' | 'warning' | 'success'
  onClick?: () => void
}

export function KpiSummaryCard({
  label,
  value,
  unit,
  change,
  changeLabel,
  status = 'default',
  onClick,
}: KpiSummaryCardProps) {
  const statusColors: Record<string, string> = {
    default: 'text-[#1A1A1A]',
    danger: 'text-[#EF4444]',
    warning: 'text-[#B45309]',
    success: 'text-[#059669]',
  }

  const displayValue = value === null || value === undefined ? '–' : value

  return (
    <div
      className={`bg-white rounded-xl border border-[#E8E8E8] p-5 ${onClick ? 'cursor-pointer hover:border-[#00C853] transition-colors' : ''}`}
      onClick={onClick}
    >
      <p className="text-xs text-[#666] mb-1">{label}</p>
      <p className={`text-3xl font-bold mb-1 ${statusColors[status]}`}>
        {displayValue}
        {unit && <span className="text-base font-normal text-[#666] ml-1">{unit}</span>}
      </p>
      {change !== null && change !== undefined && (
        <div className="flex items-center gap-1 text-xs">
          {change > 0 ? (
            <ArrowUpRight className="w-3 h-3 text-[#059669]" />
          ) : change < 0 ? (
            <ArrowDownRight className="w-3 h-3 text-[#EF4444]" />
          ) : (
            <Minus className="w-3 h-3 text-[#999]" />
          )}
          <span className={change > 0 ? 'text-[#059669]' : change < 0 ? 'text-[#EF4444]' : 'text-[#999]'}>
            {change > 0 ? '+' : ''}{change} {changeLabel ?? '전월 대비'}
          </span>
        </div>
      )}
    </div>
  )
}
```

**Step 4: KpiWidget (추상 위젯)**

```typescript
// src/components/dashboard/KpiWidget.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { WidgetSkeleton } from './WidgetSkeleton'
import { WidgetEmpty } from './WidgetEmpty'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

export type ChartType = 'bar' | 'bar-horizontal' | 'line' | 'donut' | 'number' | 'funnel' | 'heatmap'

interface KpiWidgetProps {
  title: string
  widgetId: string
  companyId: string | null
  year: number
  chartType: ChartType
  drilldownPath?: string
  dataKey?: string       // bar/line의 Y축 키
  nameKey?: string       // X축/이름 키
  height?: number
}

const CHART_COLORS = ['#00C853', '#059669', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']

export function KpiWidget({
  title,
  widgetId,
  companyId,
  year,
  chartType,
  drilldownPath,
  dataKey = 'count',
  nameKey = 'name',
  height = 200,
}: KpiWidgetProps) {
  const router = useRouter()
  const [data, setData] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ year: year.toString() })
      if (companyId) params.set('companyId', companyId)
      const res = await fetch(`/api/v1/dashboard/widgets/${widgetId}?${params}`)
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json()
      setData(json.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [widgetId, companyId, year])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) return <WidgetSkeleton height={`h-[${height + 80}px]`} />
  if (error || data === null) return <WidgetEmpty title={title} message="데이터를 불러올 수 없습니다" />

  const arrayData = Array.isArray(data) ? data : []

  return (
    <div
      className={`bg-white rounded-xl border border-[#E8E8E8] p-5 ${drilldownPath ? 'cursor-pointer hover:border-[#00C853] transition-colors' : ''}`}
      onClick={() => drilldownPath && router.push(drilldownPath)}
    >
      <p className="text-sm font-semibold text-[#1A1A1A] mb-4">{title}</p>

      <ResponsiveContainer width="100%" height={height}>
        {chartType === 'bar' ? (
          <BarChart data={arrayData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
            <XAxis dataKey={nameKey} tick={{ fontSize: 11, fill: '#666' }} />
            <YAxis tick={{ fontSize: 11, fill: '#666' }} />
            <Tooltip contentStyle={{ fontSize: 12, borderColor: '#E8E8E8' }} />
            <Bar dataKey={dataKey} fill="#00C853" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : chartType === 'bar-horizontal' ? (
          <BarChart layout="vertical" data={arrayData} margin={{ top: 4, right: 8, bottom: 4, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#666' }} />
            <YAxis dataKey={nameKey} type="category" tick={{ fontSize: 11, fill: '#666' }} width={60} />
            <Tooltip contentStyle={{ fontSize: 12, borderColor: '#E8E8E8' }} />
            <Bar dataKey={dataKey} fill="#00C853" radius={[0, 4, 4, 0]} />
          </BarChart>
        ) : chartType === 'line' ? (
          <LineChart data={arrayData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
            <XAxis dataKey={nameKey} tick={{ fontSize: 11, fill: '#666' }} />
            <YAxis tick={{ fontSize: 11, fill: '#666' }} />
            <Tooltip contentStyle={{ fontSize: 12, borderColor: '#E8E8E8' }} />
            <Line type="monotone" dataKey={dataKey} stroke="#00C853" strokeWidth={2} dot={false} />
          </LineChart>
        ) : chartType === 'donut' ? (
          <PieChart>
            <Pie
              data={arrayData}
              dataKey={dataKey}
              nameKey={nameKey}
              innerRadius={height * 0.25}
              outerRadius={height * 0.45}
              paddingAngle={2}
            >
              {arrayData.map((_: unknown, i: number) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 12, borderColor: '#E8E8E8' }} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        ) : (
          // fallback: 숫자
          <div className="flex items-center justify-center h-full">
            <span className="text-3xl font-bold text-[#1A1A1A]">{String(data)}</span>
          </div>
        )}
      </ResponsiveContainer>
    </div>
  )
}
```

**Step 5: Commit**

```bash
git add src/components/dashboard/
git commit -m "feat: add KpiWidget, KpiSummaryCard, skeleton/empty components"
```

---

## Task 6: 메인 대시보드 페이지

**Files:**
- Create: `src/app/(dashboard)/dashboard/page.tsx`
- Create: `src/app/(dashboard)/dashboard/DashboardClient.tsx`

**Step 1: page.tsx (Server Component)**

```typescript
// src/app/(dashboard)/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { prisma } from '@/lib/prisma'
import { DashboardClient } from './DashboardClient'

export const metadata = { title: 'HR KPI 대시보드 | CTR HR Hub' }

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const user = session.user as SessionUser

  // 접근 권한 체크
  const allowedRoles = [ROLE.HR_ADMIN, ROLE.SUPER_ADMIN, ROLE.EXECUTIVE]
  if (!allowedRoles.includes(user.role as never)) redirect('/')

  // 법인 목록 (SUPER_ADMIN만 전체, 나머지는 자기 법인)
  const companies =
    user.role === ROLE.SUPER_ADMIN
      ? await prisma.company.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } })
      : user.companyId
      ? await prisma.company.findMany({ where: { id: user.companyId }, select: { id: true, code: true, name: true } })
      : []

  // 기본 법인 필터
  const defaultCompanyId =
    user.role === ROLE.SUPER_ADMIN ? null : (user.companyId ?? null)

  return <DashboardClient user={user} companies={companies} defaultCompanyId={defaultCompanyId} />
}
```

**Step 2: DashboardClient.tsx**

```typescript
// src/app/(dashboard)/dashboard/DashboardClient.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { KpiSummaryCard } from '@/components/dashboard/KpiSummaryCard'
import { KpiWidget } from '@/components/dashboard/KpiWidget'
import { WidgetSkeleton } from '@/components/dashboard/WidgetSkeleton'
import { Globe } from 'lucide-react'

type Tab = 'summary' | 'workforce' | 'recruit' | 'performance' | 'attendance' | 'payroll' | 'training'

interface Company { id: string; code: string; name: string }

interface SummaryData {
  headcount: { count: number; prevCount: number | null; change: number | null } | null
  turnoverRate: { rate: number | null; change: number | null } | null
  openPositions: { count: number; avgDays: number | null } | null
  attritionRisk: { count: number; high: number; critical: number } | null
  leaveUsage: { rate: number | null } | null
  trainingCompletion: { rate: number | null; completed: number; total: number } | null
}

interface DashboardClientProps {
  user: SessionUser
  companies: Company[]
  defaultCompanyId: string | null
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'summary', label: '요약' },
  { key: 'workforce', label: '인력' },
  { key: 'recruit', label: '채용' },
  { key: 'performance', label: '성과' },
  { key: 'attendance', label: '근태' },
  { key: 'payroll', label: '급여' },
  { key: 'training', label: '교육' },
]

export function DashboardClient({ user, companies, defaultCompanyId }: DashboardClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('summary')
  const [companyId, setCompanyId] = useState<string | null>(defaultCompanyId)
  const [year, setYear] = useState(new Date().getFullYear())
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)

  const isSuperAdmin = user.role === ROLE.SUPER_ADMIN

  // 경영진 요약 KPI 로드
  useEffect(() => {
    setSummaryLoading(true)
    const params = new URLSearchParams({ year: year.toString() })
    if (companyId) params.set('companyId', companyId)
    else params.set('companyId', 'all')
    fetch(`/api/v1/dashboard/summary?${params}`)
      .then((r) => r.json())
      .then((json) => setSummary(json.data))
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false))
  }, [companyId, year])

  const widgetProps = { companyId, year }

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">HR KPI 대시보드</h1>
          <p className="text-sm text-[#666] mt-1">조직 건강도 핵심 지표</p>
        </div>
        <div className="flex items-center gap-3">
          {/* 비교 뷰 버튼 */}
          <button
            onClick={() => router.push('/dashboard/compare')}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-[#D4D4D4] rounded-lg hover:bg-[#FAFAFA] text-[#555]"
          >
            <Globe className="w-4 h-4" />
            글로벌 비교
          </button>
          {/* 연도 선택 */}
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-[#D4D4D4] rounded-lg"
          >
            {[2025, 2026].map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
          {/* 법인 필터 */}
          {(isSuperAdmin || companies.length > 1) && (
            <select
              value={companyId ?? 'all'}
              onChange={(e) => setCompanyId(e.target.value === 'all' ? null : e.target.value)}
              className="px-3 py-2 text-sm border border-[#D4D4D4] rounded-lg"
            >
              {isSuperAdmin && <option value="all">전체 법인</option>}
              {companies.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* 경영진 요약 KPI 카드 — 항상 표시 */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {summaryLoading ? (
          Array.from({ length: 6 }).map((_, i) => <WidgetSkeleton key={i} height="h-28" />)
        ) : (
          <>
            <KpiSummaryCard
              label="총 인원"
              value={summary?.headcount?.count ?? null}
              unit="명"
              change={summary?.headcount?.change ?? null}
              changeLabel="전월"
              onClick={() => router.push('/employees')}
            />
            <KpiSummaryCard
              label="이직률"
              value={summary?.turnoverRate?.rate ?? null}
              unit="%"
              change={summary?.turnoverRate?.change ?? null}
              changeLabel="전년동기"
              status={
                (summary?.turnoverRate?.rate ?? 0) > 15 ? 'danger'
                : (summary?.turnoverRate?.rate ?? 0) > 10 ? 'warning' : 'default'
              }
              onClick={() => router.push('/analytics/turnover')}
            />
            <KpiSummaryCard
              label="채용 진행"
              value={summary?.openPositions?.count ?? null}
              unit="건"
              changeLabel={summary?.openPositions?.avgDays ? `평균 ${summary.openPositions.avgDays}일` : undefined}
              onClick={() => router.push('/recruitment')}
            />
            <KpiSummaryCard
              label="이직 위험"
              value={summary?.attritionRisk?.count ?? null}
              unit="명"
              changeLabel={summary?.attritionRisk ? `위험 ${summary.attritionRisk.high} / 심각 ${summary.attritionRisk.critical}` : undefined}
              status={(summary?.attritionRisk?.count ?? 0) > 10 ? 'danger' : (summary?.attritionRisk?.count ?? 0) > 5 ? 'warning' : 'default'}
              onClick={() => router.push('/analytics/turnover')}
            />
            <KpiSummaryCard
              label="연차 사용률"
              value={summary?.leaveUsage?.rate ?? null}
              unit="%"
              onClick={() => router.push('/leave')}
            />
            <KpiSummaryCard
              label="교육 이수율"
              value={summary?.trainingCompletion?.rate ?? null}
              unit="%"
              changeLabel={summary?.trainingCompletion ? `${summary.trainingCompletion.completed}/${summary.trainingCompletion.total}명` : undefined}
              status={(summary?.trainingCompletion?.rate ?? 100) < 80 ? 'warning' : 'default'}
              onClick={() => router.push('/training')}
            />
          </>
        )}
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-[#E8E8E8]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-[#00C853] text-[#00C853]'
                : 'text-[#666] hover:text-[#333]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭별 위젯 그리드 — Lazy Mount */}
      {activeTab === 'workforce' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <KpiWidget title="직급별 인원 분포" widgetId="workforce-grade" {...widgetProps} chartType="bar-horizontal" nameKey="grade" dataKey="count" drilldownPath="/employees" />
          <KpiWidget title="법인별 인원 분포" widgetId="workforce-company" {...widgetProps} chartType="donut" nameKey="company" dataKey="count" drilldownPath="/org" />
          <KpiWidget title="입퇴사 추이 (12개월)" widgetId="workforce-trend" {...widgetProps} chartType="line" nameKey="month" dataKey="count" drilldownPath="/employees" height={220} />
          <KpiWidget title="근속 분포" widgetId="workforce-tenure" {...widgetProps} chartType="bar" nameKey="range" dataKey="count" drilldownPath="/employees" />
        </div>
      )}

      {activeTab === 'recruit' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <KpiWidget title="채용 파이프라인" widgetId="recruit-pipeline" {...widgetProps} chartType="bar" nameKey="stage" dataKey="count" drilldownPath="/recruitment" />
          <KpiWidget title="평균 충원 소요일 (법인별)" widgetId="recruit-ttr" {...widgetProps} chartType="bar" nameKey="company" dataKey="avgDays" drilldownPath="/recruitment" />
          <KpiWidget title="Talent Pool 현황" widgetId="recruit-talent-pool" {...widgetProps} chartType="number" drilldownPath="/recruitment/talent-pool" />
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <KpiWidget title="평가 등급 분포" widgetId="perf-grade" {...widgetProps} chartType="bar" nameKey="grade" dataKey="count" drilldownPath="/performance" />
          <KpiWidget title="스킬 갭 Top 5" widgetId="perf-skill-gap" {...widgetProps} chartType="bar-horizontal" nameKey="name" dataKey="avgGap" drilldownPath="/organization/skill-matrix" />
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <KpiWidget title="52시간 경고 현황" widgetId="attend-52h" {...widgetProps} chartType="bar" nameKey="level" dataKey="count" drilldownPath="/attendance/admin" />
          <KpiWidget title="연차 사용 추이 (12개월)" widgetId="attend-leave-trend" {...widgetProps} chartType="line" nameKey="month" dataKey="count" drilldownPath="/leave" height={220} />
          <KpiWidget title="번아웃 위험 분포" widgetId="attend-burnout" {...widgetProps} chartType="bar" nameKey="level" dataKey="count" drilldownPath="/analytics/team-health" />
        </div>
      )}

      {activeTab === 'payroll' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <KpiWidget title="법인별 인건비 (백만 KRW)" widgetId="payroll-cost" {...widgetProps} chartType="bar" nameKey="company" dataKey="totalKrw" drilldownPath="/payroll/global" />
        </div>
      )}

      {activeTab === 'training' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <KpiWidget title="법정교육 이수현황" widgetId="training-mandatory" {...widgetProps} chartType="bar" nameKey="courseTitle" dataKey="rate" drilldownPath="/training" />
          <KpiWidget title="복리후생 활용률" widgetId="training-benefit" {...widgetProps} chartType="bar" nameKey="category" dataKey="count" drilldownPath="/benefits" />
        </div>
      )}
    </div>
  )
}
```

**Step 3: TypeScript 검증**

```bash
npx tsc --noEmit 2>&1 | grep "dashboard/" | head -30
```

**Step 4: Commit**

```bash
git add src/app/(dashboard)/dashboard/
git commit -m "feat: add HR KPI dashboard main page with lazy-loaded tab widgets"
```

---

## Task 7: 글로벌 비교 뷰

**Files:**
- Create: `src/app/(dashboard)/dashboard/compare/page.tsx`
- Create: `src/app/(dashboard)/dashboard/compare/CompareClient.tsx`

**Step 1: page.tsx**

```typescript
// src/app/(dashboard)/dashboard/compare/page.tsx
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { CompareClient } from './CompareClient'

export const metadata = { title: '글로벌 법인 비교 | CTR HR Hub' }

export default async function ComparePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  const allowedRoles = [ROLE.HR_ADMIN, ROLE.SUPER_ADMIN, ROLE.EXECUTIVE]
  if (!allowedRoles.includes(user.role as never)) redirect('/dashboard')
  return <CompareClient />
}
```

**Step 2: CompareClient.tsx**

```typescript
// src/app/(dashboard)/dashboard/compare/CompareClient.tsx
'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { WidgetSkeleton } from '@/components/dashboard/WidgetSkeleton'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

type KpiKey = 'turnover_rate' | 'leave_usage' | 'training_completion' | 'payroll_cost'

const KPI_OPTIONS: { key: KpiKey; label: string; unit: string }[] = [
  { key: 'turnover_rate', label: '이직률', unit: '%' },
  { key: 'leave_usage', label: '연차 사용률', unit: '%' },
  { key: 'training_completion', label: '교육 이수율', unit: '%' },
  { key: 'payroll_cost', label: '인건비', unit: '백만 KRW' },
]

const CHART_COLORS = ['#00C853', '#059669', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']

export function CompareClient() {
  const router = useRouter()
  const [kpi, setKpi] = useState<KpiKey>('turnover_rate')
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState<{ results: { company: string; value: number | null }[]; trend: { companyId: string; snapshotDate: string; data: unknown }[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/v1/dashboard/compare?kpi=${kpi}&year=${year}`)
      .then((r) => r.json())
      .then((json) => setData(json.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [kpi, year])

  const kpiOption = KPI_OPTIONS.find((o) => o.key === kpi)

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="p-2 hover:bg-[#F5F5F5] rounded-lg">
          <ArrowLeft className="w-5 h-5 text-[#555]" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">글로벌 법인 비교</h1>
          <p className="text-sm text-[#666] mt-1">6개 법인 KPI 나란히 비교</p>
        </div>
      </div>

      {/* 컨트롤 */}
      <div className="flex items-center gap-3">
        <select
          value={kpi}
          onChange={(e) => setKpi(e.target.value as KpiKey)}
          className="px-3 py-2 text-sm border border-[#D4D4D4] rounded-lg"
        >
          {KPI_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-2 text-sm border border-[#D4D4D4] rounded-lg"
        >
          {[2025, 2026].map((y) => <option key={y} value={y}>{y}년</option>)}
        </select>
      </div>

      {loading ? (
        <WidgetSkeleton height="h-64" />
      ) : !data ? (
        <div className="bg-white rounded-xl border border-[#E8E8E8] p-10 text-center text-sm text-[#999]">
          데이터를 불러올 수 없습니다
        </div>
      ) : (
        <>
          {/* 바 차트 — 법인 비교 */}
          <div className="bg-white rounded-xl border border-[#E8E8E8] p-5">
            <p className="text-sm font-semibold text-[#1A1A1A] mb-4">
              {kpiOption?.label} 법인 비교 ({year}년, {kpiOption?.unit})
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.results} layout="vertical" margin={{ left: 20, right: 20, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#666' }} />
                <YAxis dataKey="company" type="category" tick={{ fontSize: 12, fill: '#333' }} width={50} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderColor: '#E8E8E8' }}
                  formatter={(v: number) => [`${v} ${kpiOption?.unit}`, kpiOption?.label]}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {data.results.map((_: unknown, i: number) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 추이 라인 차트 */}
          {data.trend.length > 0 && (
            <div className="bg-white rounded-xl border border-[#E8E8E8] p-5">
              <p className="text-sm font-semibold text-[#1A1A1A] mb-4">월별 추이</p>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data.trend} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
                  <XAxis dataKey="snapshotDate" tick={{ fontSize: 11, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#666' }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderColor: '#E8E8E8' }} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="value" stroke="#00C853" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

**Step 3: TypeScript 검증 + Commit**

```bash
npx tsc --noEmit 2>&1 | grep "compare" | head -10
git add src/app/(dashboard)/dashboard/compare/
git commit -m "feat: add global company compare view"
```

---

## Task 8: 사이드바 내비게이션 추가

**Files:**
- Modify: `src/config/navigation.ts`

**Step 1: 인사이트 섹션에 KPI 대시보드 항목 추가**

`navigation.ts` 파일에서 `insights` 섹션 items를 찾아 맨 앞에 추가:

```typescript
// insights 섹션 items 배열 맨 앞에 추가
{
  key: 'kpi-dashboard',
  labelKey: 'nav.insights.kpiDashboard',
  label: 'HR KPI 대시보드',
  href: '/dashboard',
  icon: LayoutDashboard,
  module: 'analytics',
},
```

`LayoutDashboard`가 이미 import 되어 있지 않으면:
```typescript
import { LayoutDashboard } from 'lucide-react'
```

**Step 2: TypeScript 검증 + Commit**

```bash
npx tsc --noEmit 2>&1 | grep "navigation" | head -10
git add src/config/navigation.ts
git commit -m "feat: add KPI dashboard to insights navigation"
```

---

## Task 9: TypeScript 전체 검증 + 빌드

**Step 1: TypeScript 0 에러 확인**

```bash
npx tsc --noEmit 2>&1
```

오류 발생 시 패턴별 수정:

```typescript
// ❌ 흔한 실수 1: apiClient 응답 언래핑 누락
const data = await apiClient.get<T>(url)  // wrong
const { data } = await apiClient.get<T>(url)  // correct: res.data

// ❌ 흔한 실수 2: ACTION 잘못 사용
ACTION.READ  // X — 존재하지 않음
ACTION.VIEW  // ✅

// ❌ 흔한 실수 3: throw 없이 return
return badRequest('msg')  // X
throw badRequest('msg')   // ✅

// ❌ 흔한 실수 4: @db.Uuid 사용
id String @id @default(uuid()) @db.Uuid  // X
id String @id @default(uuid())           // ✅
```

**Step 2: Next.js 빌드 검증**

```bash
npm run build
```

Expected: `✓ Compiled successfully`

**Step 3: 최종 Commit**

```bash
git add -A
git commit -m "fix: resolve TypeScript errors for B10-2 KPI dashboard"
```

---

## Task 10: context/TRACK_A.md 업데이트

**Files:**
- Modify: `context/TRACK_A.md` (끝에 추가, SHARED.md / TRACK_B.md 절대 수정 금지)

**Step 1: TRACK_A.md 끝에 추가**

```markdown
---

# Track A — B10-2: HR KPI 대시보드 완료 보고

> 완료일: 2026-03-03
> 검증: `tsc --noEmit` ✅ 0 errors | `npm run build` ✅ 성공

## DB 테이블
- `kpi_dashboard_configs` — 사용자별 대시보드 레이아웃 저장
- 마이그레이션: `a_kpi_dashboard`

## 주요 라우트
- `/dashboard` — HR KPI 메인 대시보드 (HR_ADMIN/SUPER_ADMIN/EXECUTIVE)
- `/dashboard/compare` — 글로벌 법인 비교 뷰

## API Routes
- `GET /api/v1/dashboard/summary` — 6개 핵심 KPI (Promise.allSettled 방어 코딩)
- `GET /api/v1/dashboard/widgets/[widgetId]` — 탭별 위젯 데이터 (15개 widgetId)
- `GET /api/v1/dashboard/compare` — 법인 비교 + 추이

## 위젯 목록 (widgetId: 데이터소스: 차트타입)
- workforce-grade: EmployeeAssignment groupBy jobGradeId: bar-horizontal
- workforce-company: EmployeeAssignment groupBy companyId: donut
- workforce-trend: AnalyticsSnapshot (headcount): line
- workforce-tenure: EmployeeAssignment + Employee.hireDate: bar
- recruit-pipeline: Application groupBy stage: bar
- recruit-ttr: Application (HIRED) avg sojourn: bar
- recruit-talent-pool: TalentPool count: number
- perf-grade: PerformanceEvaluation groupBy performanceGrade: bar
- perf-skill-gap: EmployeeSkillAssessment gap 상위 5: bar-horizontal
- attend-52h: WorkHourAlert groupBy alertLevel: bar
- attend-leave-trend: LeaveRequest 월별 count: line
- attend-burnout: BurnoutScore groupBy riskLevel: bar
- payroll-cost: PayrollRun + ExchangeRate KRW 환산: bar
- training-mandatory: TrainingEnrollment (mandatory_auto): bar
- training-benefit: BenefitClaim groupBy category: bar

## 컴포넌트
- `src/components/dashboard/KpiWidget.tsx` — 추상 위젯 (모든 chart type 지원)
- `src/components/dashboard/KpiSummaryCard.tsx` — 숫자형 KPI 카드 + 전월 변동
- `src/components/dashboard/WidgetSkeleton.tsx` — 로딩 스켈레톤
- `src/components/dashboard/WidgetEmpty.tsx` — 빈 상태

## 설계 결정
- 클라이언트 완전 독립 위젯 방식 (위젯별 독립 fetch, Promise.allSettled)
- 탭별 lazy mount — 요약 탭 6개 KPI만 초기 로드
- 법인 필터: SUPER_ADMIN → 전체, HR_ADMIN/EXECUTIVE → 자기 법인
- 방어 코딩: 위젯 실패 시 null 반환 → WidgetEmpty 표시, 전체 영향 없음

## 다음 세션 연동 포인트
- B11 ([B] 트랙): 시스템 설정에 대시보드 위젯 설정 통합
- B11 (후반부): 위험 KPI 알림 배지 (이직위험/번아웃 기준 초과 시)
- 9-Block 위젯 (perf-9block): CalibrationSession 데이터 구조 확인 후 추가 예정
```

**Step 2: Commit**

```bash
git add context/TRACK_A.md
git commit -m "docs: update TRACK_A.md with B10-2 completion"
```

---

## 검증 체크리스트

- [ ] `kpi_dashboard_configs` 테이블 생성 (`a_kpi_dashboard` 마이그레이션)
- [ ] `GET /api/v1/dashboard/summary` — 6개 KPI 반환, Promise.allSettled 적용
- [ ] `GET /api/v1/dashboard/widgets/[widgetId]` — 15개 widgetId 지원
- [ ] `GET /api/v1/dashboard/compare` — 6법인 + 추이 반환
- [ ] `/dashboard` — 경영진 요약 6개 KPI 카드 + 탭 위젯 그리드
- [ ] `/dashboard/compare` — KPI 선택 + 바 차트 + 추이 라인
- [ ] 탭별 lazy mount (요약 탭만 초기 로드)
- [ ] 위젯 실패 시 해당 위젯만 "데이터 없음", 나머지 정상
- [ ] 법인 필터 기본값 (SUPER_ADMIN → 전체, HR_ADMIN → 자기 법인)
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` 성공
- [ ] `context/TRACK_A.md` 업데이트 완료
