import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { withCache, CACHE_STRATEGY } from '@/lib/cache'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { getDirectReportIds } from '@/lib/employee/direct-reports'
import { getStartOfDayTz, formatToTz } from '@/lib/timezone'
import type { SessionUser, OnboardingItem, TrendPoint } from '@/types'

// Default company timezone for D-day calculations.
// Phase 6: resolve from user.companyId via timezone helper.
const DEFAULT_TZ = 'Asia/Seoul'

// ─── Helpers ────────────────────────────────────────────────

function getCurrentQuarter(now: Date): { year: number; quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4' } {
  const q = Math.ceil((now.getMonth() + 1) / 3) as 1 | 2 | 3 | 4
  return { year: now.getFullYear(), quarter: `Q${q}` as 'Q1' | 'Q2' | 'Q3' | 'Q4' }
}

function aggregateQrStats(groups: { status: string; _count: { _all: number } }[]) {
  let total = 0
  let completed = 0
  for (const g of groups) {
    total += g._count._all
    if (g.status === 'COMPLETED') completed += g._count._all
  }
  return { total, completed, pending: total - completed }
}

/**
 * Calendar day difference between two dates, anchored to the company timezone.
 * Both operands are normalized to midnight in `tz` (DEFAULT_TZ = Asia/Seoul) before subtraction,
 * so users in any browser locale see consistent D-day labels for the same business date.
 * Returns positive when `target` is in the future, negative when in the past.
 */
function daysBetween(target: Date, ref: Date, tz: string = DEFAULT_TZ): number {
  const a = getStartOfDayTz(target, tz).getTime()
  const b = getStartOfDayTz(ref, tz).getTime()
  return Math.round((a - b) / (1000 * 60 * 60 * 24))
}

/** EmployeeOnboarding + hydrated task counts → OnboardingItem */
function toOnboardingItem(
  ob: {
    employeeId: string
    employee?: { id: string; name: string; hireDate?: Date } | null
    startedAt: Date | null
    tasks: { status: string }[]
  } & { name?: string; department?: string | null; startDate?: Date | null },
  fallbackName: string,
  referenceDate: Date = new Date(),
): OnboardingItem {
  const total = ob.tasks.length
  const completed = ob.tasks.filter((t) => t.status === 'DONE').length
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0
  // Priority: explicit startDate (e.g. computed) > startedAt (instance) > hireDate (fallback)
  const rawStart = ob.startDate ?? ob.startedAt ?? ob.employee?.hireDate
  const startIso = rawStart ? new Date(rawStart).toISOString() : null
  const daysUntilStart = rawStart ? daysBetween(new Date(rawStart), referenceDate) : null
  return {
    employeeId: ob.employeeId,
    name: ob.employee?.name ?? fallbackName,
    department: ob.department ?? null,
    startDate: startIso,
    daysUntilStart,
    progress,
    completedTasks: completed,
    totalTasks: total,
  }
}

/** Onboarding sort: NOT_STARTED(미래) 우선 → 시작 임박 순 */
function sortOnboardingByUrgency(items: OnboardingItem[]): OnboardingItem[] {
  return [...items].sort((a, b) => {
    const aDays = a.daysUntilStart ?? Number.POSITIVE_INFINITY
    const bDays = b.daysUntilStart ?? Number.POSITIVE_INFINITY
    // Future events (positive) come first, ascending. Past events (negative) come after.
    if (aDays >= 0 && bDays >= 0) return aDays - bDays
    if (aDays < 0 && bDays < 0) return bDays - aDays
    return aDays >= 0 ? -1 : 1
  })
}

/** Offboarding sort: overdue(과거) 우선 → 그 다음 임박한 미래 */
function sortOffboardingByUrgency(items: OnboardingItem[]): OnboardingItem[] {
  return [...items].sort((a, b) => {
    const aDays = a.daysUntilStart ?? Number.POSITIVE_INFINITY
    const bDays = b.daysUntilStart ?? Number.POSITIVE_INFINITY
    // Overdue (negative) first, most overdue first. Then future, ascending (soonest exit first).
    if (aDays < 0 && bDays < 0) return aDays - bDays // more negative = more overdue, comes first
    if (aDays >= 0 && bDays >= 0) return aDays - bDays
    return aDays < 0 ? -1 : 1
  })
}

/**
 * Bucket Date[] into 7 daily buckets ending at `end` (inclusive).
 * Returns ascending [oldest...newest]. Empty days return 0.
 * Codex Gate 1 HIGH fix: Prisma groupBy(DateTime) buckets by exact timestamp,
 * not by day. Use findMany + JS bucketing for deterministic fixed-width buckets.
 */
function bucketDaily(dates: Date[], end: Date, days: number, tz: string = DEFAULT_TZ): TrendPoint[] {
  const counts = new Map<string, number>()
  // Pre-fill: derive each day key by subtracting i days from `end` in tz.
  // getStartOfDayTz returns a UTC instant of local midnight; we format back in tz to get the local date string.
  for (let i = days - 1; i >= 0; i--) {
    const anchor = new Date(end)
    anchor.setDate(anchor.getDate() - i)
    counts.set(formatToTz(anchor, tz, 'yyyy-MM-dd'), 0)
  }
  for (const ts of dates) {
    const key = formatToTz(ts, tz, 'yyyy-MM-dd')
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([bucket, value]) => ({ bucket, value }))
}

/**
 * Bucket Date[] into `weeks` weekly buckets (Mon-Sun) ending at the current week's Monday.
 * Returns ascending.
 */
function bucketWeekly(dates: Date[], end: Date, weeks: number, tz: string = DEFAULT_TZ): TrendPoint[] {
  // ISO-week Monday calculation using tz-local date string.
  // Using UTC getDay() on local Date is timezone-fragile; derive via formatToTz 'yyyy-MM-dd' then parseISO.
  const mondayOf = (d: Date): string => {
    const localStr = formatToTz(d, tz, 'yyyy-MM-dd') // YYYY-MM-DD local
    const [y, m, day] = localStr.split('-').map(Number)
    // Use UTC date arithmetic (no DST) — the local date as a naive UTC date for day-of-week arithmetic
    const naive = new Date(Date.UTC(y, m - 1, day))
    const wday = naive.getUTCDay() // 0=Sun..6=Sat
    const diffToMon = wday === 0 ? -6 : 1 - wday
    naive.setUTCDate(naive.getUTCDate() + diffToMon)
    return naive.toISOString().slice(0, 10)
  }

  const counts = new Map<string, number>()
  const anchorMon = mondayOf(end)
  const [ay, am, ad] = anchorMon.split('-').map(Number)
  for (let i = weeks - 1; i >= 0; i--) {
    const wk = new Date(Date.UTC(ay, am - 1, ad))
    wk.setUTCDate(wk.getUTCDate() - i * 7)
    counts.set(wk.toISOString().slice(0, 10), 0)
  }
  for (const ts of dates) {
    const key = mondayOf(ts)
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([bucket, value]) => ({ bucket, value }))
}

/** EmployeeOffboarding → OnboardingItem (shared DTO) */
function toOffboardingItem(
  ob: {
    employeeId: string
    employee?: { id: string; name: string } | null
    lastWorkingDate: Date
    offboardingTasks: { status: string }[]
  },
  fallbackName: string,
  referenceDate: Date = new Date(),
): OnboardingItem {
  const total = ob.offboardingTasks.length
  const completed = ob.offboardingTasks.filter((t) => t.status === 'DONE').length
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0
  const daysUntilStart = daysBetween(ob.lastWorkingDate, referenceDate)
  return {
    employeeId: ob.employeeId,
    name: ob.employee?.name ?? fallbackName,
    department: null,
    startDate: ob.lastWorkingDate.toISOString(),
    daysUntilStart,
    progress,
    completedTasks: completed,
    totalTasks: total,
  }
}

// ─── Route ──────────────────────────────────────────────────

export const GET = withCache(withPermission(
  async (
    _req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const companyId = user.companyId
      const now = new Date()
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const { year: qrYear, quarter: qrQuarter } = getCurrentQuarter(now)

      // Common: total employees
      const totalEmployees = await prisma.employeeAssignment.count({
        where: { companyId, status: 'ACTIVE', isPrimary: true, endDate: null },
      })

      if (user.role === ROLE.EMPLOYEE) {
        const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

        const [
          leaveBalance,
          attendanceCount,
          qrReview,
          myOnboardingRaw,
          myOffboardingRaw,
        ] = await Promise.all([
          prisma.employeeLeaveBalance.findMany({
            where: { employeeId: user.employeeId },
            include: { policy: { select: { name: true, leaveType: true } } },
          }),
          prisma.attendance.count({
            where: {
              employeeId: user.employeeId,
              workDate: { gte: new Date(`${thisMonth}-01`) },
            },
          }),
          prisma.quarterlyReview.findFirst({
            where: { employeeId: user.employeeId, year: qrYear, quarter: qrQuarter },
            select: { id: true, status: true },
          }),
          // D2: planType='ONBOARDING' 명시 — crossboarding 제외, 활성 offboarding이 있으면 onboarding 숨김
          prisma.employeeOnboarding.findFirst({
            where: {
              employeeId: user.employeeId,
              planType: 'ONBOARDING',
              status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
              employee: {
                employeeOffboardings: {
                  none: { status: 'IN_PROGRESS' },
                },
              },
            },
            include: {
              employee: { select: { id: true, name: true, hireDate: true } },
              tasks: { select: { status: true } },
            },
            orderBy: { createdAt: 'desc' },
          }),
          prisma.employeeOffboarding.findFirst({
            where: {
              employeeId: user.employeeId,
              status: 'IN_PROGRESS',
            },
            include: {
              employee: { select: { id: true, name: true } },
              offboardingTasks: { select: { status: true } },
            },
            orderBy: { lastWorkingDate: 'asc' },
          }),
        ])

        const myOnboarding = myOnboardingRaw
          ? toOnboardingItem(
              {
                employeeId: myOnboardingRaw.employeeId,
                employee: myOnboardingRaw.employee
                  ? {
                      id: myOnboardingRaw.employee.id,
                      name: myOnboardingRaw.employee.name,
                      hireDate: myOnboardingRaw.employee.hireDate,
                    }
                  : null,
                startedAt: myOnboardingRaw.startedAt,
                tasks: myOnboardingRaw.tasks,
              },
              user.name,
              now,
            )
          : null

        const myOffboarding = myOffboardingRaw
          ? toOffboardingItem(
              {
                employeeId: myOffboardingRaw.employeeId,
                employee: myOffboardingRaw.employee,
                lastWorkingDate: myOffboardingRaw.lastWorkingDate,
                offboardingTasks: myOffboardingRaw.offboardingTasks,
              },
              user.name,
              now,
            )
          : null

        return apiSuccess({
          role: 'EMPLOYEE',
          totalEmployees,
          leaveBalance: leaveBalance.map((lb) => ({
            policy: lb.policy.name,
            leaveType: lb.policy.leaveType,
            remaining: Number(lb.grantedDays) - Number(lb.usedDays) - Number(lb.pendingDays),
            used: Number(lb.usedDays),
            total: Number(lb.grantedDays),
          })),
          attendanceThisMonth: attendanceCount,
          quarterlyReview: qrReview
            ? { id: qrReview.id, status: qrReview.status }
            : { id: null, status: null },
          myOnboarding,
          myOffboarding,
        })
      }

      if (user.role === ROLE.MANAGER) {
        // home/summary는 직속 보고만 본다 (company-scoped KPI 용도 — 아래 leave/oneOnOne/qr 쿼리가
        // 모두 companyId 필터를 걸기 때문에 cross-company 직원은 어차피 필터아웃된다).
        // cross-company dotted-line이 필요한 경우 manager-hub/summary의 getAllReportIds를 사용.
        const reportIds = await getDirectReportIds(user.employeeId)
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        // R2 pilot: trend window boundaries for sparklines.
        // Codex Gate 2 P2 fix: anchor cutoffs in `DEFAULT_TZ` (Asia/Seoul) to match bucketing —
        // server-local midnight diverges from tz midnight on Vercel (UTC) and truncates the oldest bucket.
        const tzMidnight = getStartOfDayTz(now, DEFAULT_TZ)
        const sevenDaysAgo = new Date(tzMidnight)
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6) // 7 days inclusive of today
        const fourWeeksAgo = new Date(tzMidnight)
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 27) // 4 weeks inclusive of current week

        const [
          teamCount,
          pendingLeaves,
          overdueLeaves,
          scheduledOneOnOnes,
          qrGroups,
          teamOnboardingRaw,
          teamOffboardingRaw,
          pendingLeavesTrendRaw,
          oneOnOneTrendRaw,
        ] = await Promise.all([
          // reportIds 기반 + companyId 필터 (좁고 안전한 scope)
          prisma.employee.count({
            where: {
              id: { in: reportIds },
              assignments: {
                some: { companyId, status: 'ACTIVE', isPrimary: true, endDate: null },
              },
            },
          }),
          prisma.leaveRequest.count({
            where: { companyId, status: 'PENDING', employeeId: { in: reportIds } },
          }),
          prisma.leaveRequest.count({
            where: {
              companyId,
              status: 'PENDING',
              employeeId: { in: reportIds },
              startDate: { lt: todayStart },
            },
          }),
          prisma.oneOnOne.count({
            where: { managerId: user.employeeId, companyId, status: 'SCHEDULED' },
          }),
          prisma.quarterlyReview.groupBy({
            by: ['status'],
            where: { companyId, employeeId: { in: reportIds }, year: qrYear, quarter: qrQuarter },
            _count: { _all: true },
          }),
          // D2: team onboarding — application-level sort by D-day urgency.
          // companyId on EmployeeOnboarding instance is sufficient (NOT_STARTED hires
          // may not yet have ACTIVE assignment).
          prisma.employeeOnboarding.findMany({
            where: {
              companyId,
              employeeId: { in: reportIds },
              planType: 'ONBOARDING',
              status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
              employee: {
                employeeOffboardings: { none: { status: 'IN_PROGRESS' } },
              },
            },
            include: {
              employee: { select: { id: true, name: true, hireDate: true } },
              tasks: { select: { status: true } },
            },
          }),
          // offboarding 회사 식별 한계: EmployeeOffboarding.companyId 컬럼 부재.
          // 가장 정확한 근사 — 가장 최근 primary assignment(endDate: null)가 본 회사인 경우.
          // Phase 6에서 EmployeeOffboarding.companyId 컬럼 추가 후 정확한 필터 가능.
          prisma.employeeOffboarding.findMany({
            where: {
              employeeId: { in: reportIds },
              status: 'IN_PROGRESS',
              employee: {
                assignments: { some: { companyId, isPrimary: true, endDate: null } },
              },
            },
            include: {
              employee: { select: { id: true, name: true } },
              offboardingTasks: { select: { status: true } },
            },
          }),
          // R2 pilot: last 7 days of *currently-pending* leave requests (submitted-date trend).
          // Semantic: inflow of still-open requests, bucketed by submission day. Not a historical
          // backlog snapshot — that would require status-transition history. Codex Gate 1 MEDIUM.
          prisma.leaveRequest.findMany({
            where: {
              companyId,
              status: 'PENDING',
              employeeId: { in: reportIds },
              createdAt: { gte: sevenDaysAgo },
            },
            select: { createdAt: true },
          }),
          // R2 pilot: last 4 weeks of 1:1 meetings (SCHEDULED + COMPLETED), weekly buckets.
          // Codex Gate 2 P2 fix: exclude CANCELLED/NO_SHOW to align with headline scheduledOneOnOnes count.
          prisma.oneOnOne.findMany({
            where: {
              managerId: user.employeeId,
              companyId,
              scheduledAt: { gte: fourWeeksAgo },
              status: { in: ['SCHEDULED', 'COMPLETED'] },
            },
            select: { scheduledAt: true },
          }),
        ])

        const teamOnboarding = sortOnboardingByUrgency(
          teamOnboardingRaw.map((ob) =>
            toOnboardingItem(
              {
                employeeId: ob.employeeId,
                employee: ob.employee,
                startedAt: ob.startedAt,
                tasks: ob.tasks,
              },
              ob.employee?.name ?? '',
              now,
            ),
          ),
        ).slice(0, 5)
        const teamOffboarding = sortOffboardingByUrgency(
          teamOffboardingRaw.map((ob) =>
            toOffboardingItem(
              {
                employeeId: ob.employeeId,
                employee: ob.employee,
                lastWorkingDate: ob.lastWorkingDate,
                offboardingTasks: ob.offboardingTasks,
              },
              ob.employee?.name ?? '',
              now,
            ),
          ),
        ).slice(0, 5)

        const pendingLeavesTrend = bucketDaily(
          pendingLeavesTrendRaw.map((r) => r.createdAt),
          now,
          7,
        )
        const oneOnOneTrend = bucketWeekly(
          oneOnOneTrendRaw.map((r) => r.scheduledAt),
          now,
          4,
        )

        return apiSuccess({
          role: 'MANAGER',
          totalEmployees,
          teamCount,
          pendingLeaves,
          overdueLeaves,
          scheduledOneOnOnes,
          quarterlyReviewStats: aggregateQrStats(qrGroups),
          teamOnboarding,
          teamOffboarding,
          pendingLeavesTrend,
          oneOnOneTrend,
        })
      }

      // HR_ADMIN / SUPER_ADMIN / EXECUTIVE
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekFromNow = new Date(todayStart)
      weekFromNow.setDate(weekFromNow.getDate() + 8) // 7일 후까지 inclusive (lt 8 = lte 7)

      // EXECUTIVE는 onboarding 트래커를 사용하지 않으므로 해당 쿼리 생략 (P3 latency 절감)
      const isExecutive = user.role === ROLE.EXECUTIVE

      const [
        newHires,
        terminations,
        openPositions,
        pendingLeaves,
        urgentCount,
        weekDeadlineCount,
        qrGroups,
        activeOnboardingRaw,
        activeOffboardingRaw,
        onboardingTotal,
      ] = await Promise.all([
        prisma.employee.count({
          where: {
            hireDate: { gte: thirtyDaysAgo },
            assignments: { some: { companyId, isPrimary: true, endDate: null } },
          },
        }),
        prisma.employeeAssignment.count({
          where: { companyId, status: 'TERMINATED', isPrimary: true, updatedAt: { gte: thirtyDaysAgo } },
        }),
        prisma.jobPosting.count({
          where: { companyId, status: 'OPEN', deletedAt: null },
        }),
        prisma.leaveRequest.count({
          where: { companyId, status: 'PENDING' },
        }),
        // Urgent: pending leave whose start date is before today (overdue)
        prisma.leaveRequest.count({
          where: {
            companyId,
            status: 'PENDING',
            startDate: { lt: todayStart },
          },
        }),
        // Week deadline: pending leave whose start date is within next 7 days
        prisma.leaveRequest.count({
          where: {
            companyId,
            status: 'PENDING',
            startDate: { gte: todayStart, lt: weekFromNow },
          },
        }),
        // EXECUTIVE는 quarterlyReviewStats 사용 안 함 — 빈 배열 placeholder
        isExecutive
          ? Promise.resolve([] as { status: string; _count: { _all: number } }[])
          : prisma.quarterlyReview.groupBy({
              by: ['status'],
              where: { companyId, year: qrYear, quarter: qrQuarter },
              _count: { _all: true },
            }),
        // EXECUTIVE는 onboarding 트래커 미사용 — 빈 배열로 skip
        isExecutive
          ? Promise.resolve([])
          : // D2: Company-scoped onboarding list. application-level sort by D-day urgency.
            prisma.employeeOnboarding.findMany({
              where: {
                companyId,
                planType: 'ONBOARDING',
                status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
                employee: {
                  employeeOffboardings: { none: { status: 'IN_PROGRESS' } },
                },
              },
              include: {
                employee: { select: { id: true, name: true, hireDate: true } },
                tasks: { select: { status: true } },
              },
            }),
        // EXECUTIVE는 offboarding 트래커 미사용
        isExecutive
          ? Promise.resolve([])
          : // offboarding 회사 필터: EmployeeOffboarding.companyId 부재 → primary assignment 근사.
            // 가장 최근(endDate: null) primary assignment가 본 회사인 경우만.
            // Phase 6에서 EmployeeOffboarding.companyId 컬럼 추가 후 정확화.
            prisma.employeeOffboarding.findMany({
              where: {
                status: 'IN_PROGRESS',
                employee: {
                  assignments: {
                    some: { companyId, isPrimary: true, endDate: null },
                  },
                },
              },
              include: {
                employee: { select: { id: true, name: true } },
                offboardingTasks: { select: { status: true } },
              },
            }),
        isExecutive
          ? Promise.resolve(0)
          : prisma.employeeOnboarding.count({
              where: {
                companyId,
                planType: 'ONBOARDING',
                status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
                employee: {
                  employeeOffboardings: { none: { status: 'IN_PROGRESS' } },
                },
              },
            }),
      ])

      const turnoverRate =
        totalEmployees > 0
          ? Math.round((terminations / totalEmployees) * 1000) / 10
          : 0

      const qrStats = aggregateQrStats(qrGroups)

      const activeOnboarding = sortOnboardingByUrgency(
        activeOnboardingRaw.map((ob) =>
          toOnboardingItem(
            {
              employeeId: ob.employeeId,
              employee: ob.employee,
              startedAt: ob.startedAt,
              tasks: ob.tasks,
            },
            ob.employee?.name ?? '',
            now,
          ),
        ),
      ).slice(0, 5)
      const activeOffboarding = sortOffboardingByUrgency(
        activeOffboardingRaw.map((ob) =>
          toOffboardingItem(
            {
              employeeId: ob.employeeId,
              employee: ob.employee,
              lastWorkingDate: ob.lastWorkingDate,
              offboardingTasks: ob.offboardingTasks,
            },
            ob.employee?.name ?? '',
            now,
          ),
        ),
      ).slice(0, 5)

      return apiSuccess({
        role: user.role,
        totalEmployees,
        newHires,
        terminations,
        turnoverRate,
        openPositions,
        pendingLeaves,
        urgentCount,
        weekDeadlineCount,
        quarterlyReviewStats: {
          ...qrStats,
          completionRate: qrStats.total > 0
            ? Math.round((qrStats.completed / qrStats.total) * 100)
            : 0,
        },
        activeOnboarding,
        activeOffboarding,
        onboardingCount: onboardingTotal,
      })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
), CACHE_STRATEGY.DASHBOARD_KPI, 'user')
