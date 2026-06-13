// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance-rate orchestration (PR-4b)
// 출근율% 데이터 공급: roster(직원당 active-primary 1건) + generate_series 달력으로
// "소정근로일(eligible date)" 교차 → 그 위에서만 출근/휴가 집계(grouped SQL, raw-row 미로드).
// 순수 공식·집계는 eligibility.ts. 멀티테넌트: 모든 CTE/JOIN company_id=$1 명시.
//
// Codex Gate1 ×4 잠금: present는 근무일에서만(주말상쇄 방지)·LOA 제외·LOA/leave/holiday 전부
// company-scoped·퇴사일 inclusive·effective_date DATE비교·미배정(dept null) 보존·leave per-day cap.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { formatToTz } from '@/lib/timezone'
import { addDaysStr, firstDayMonthsAgo, monthRange } from './trends'
import {
  formulaForJobCategory,
  employeePair,
  aggregate,
  UNSUPPORTED_POINT,
  DEFAULT_COHORT_MIN,
  type EmployeePair,
  type AggregateResult,
} from './eligibility'
import type { JobCategoryCode } from '@/generated/prisma/enums'

const DEFAULT_TIMEZONE = 'Asia/Seoul'
const TREND_MONTHS = 12
const DEPT_WINDOW_DAYS = 30
const STANDARD_DAYS_PER_WEEK = 5

// ─── Types ──────────────────────────────────────────────────

export type RatePoint = AggregateResult

export interface RateTrendMonth {
  month: string // "YYYY-MM"
  management: RatePoint // EXCUSED 직군군 (사무·관리·연구·미지정)
  production: RatePoint // STRICT 직군 (생산직)
}

export interface RosterDept {
  departmentName: string
  rosterCount: number
}

export interface RateMeta {
  supported: boolean
  reason: 'SHIFT' | 'NON_STANDARD_WEEK' | null
  cohortMin: number
  rosterCount: number
  unclassifiedCount: number // 직군 미지정 직원 수
  anomalyCount: number // 출근수>분모로 clamp된 직원-월 수 (12mo 기준)
  classMix: { management: number; production: number }
  basisNote: 'CURRENT_ROSTER'
}

export interface AttendanceRate {
  /** roster 부서 universe (dept 칸 universe 통합용; department_id NOT NULL) */
  rosterDepts: Map<string, RosterDept>
  /** 부서별 출근율 (30일, 혼합). dept가 없거나 unsupported면 미존재 */
  deptRates: Map<string, RatePoint>
  /** 12개월 직군별 2선 (zero-fill) */
  rateTrend: RateTrendMonth[]
  rateMeta: RateMeta
}

interface RosterRow {
  employee_id: string
  department_id: string | null
  department_name: string | null
  job_category_code: JobCategoryCode | null
}

interface FeederRow {
  department_id: string | null
  job_category_code: JobCategoryCode | null
  employee_id: string
  ym: string | null
  elig_days: number
  leave_days: number
  normal_elig: number
  present_elig: number
}

// ─── SQL (positional params: $1=companyId, $2=today(date str), $3=winStart(date str)) ──

// 직원당 active-primary 1건. 법인/상태 = employee_assignments (Employee엔 없음).
// d.id AS department_id → 교차법인/삭제 부서는 LEFT JOIN으로 null 처리.
const ROSTER_CTE = `roster AS (
  SELECT DISTINCT ON (ea.employee_id)
    ea.employee_id,
    d.id   AS department_id,
    d.name AS department_name,
    jc.code AS job_category_code,
    e.hire_date,
    e.resign_date
  FROM employee_assignments ea
  JOIN employees e        ON e.id = ea.employee_id AND e.deleted_at IS NULL
  LEFT JOIN departments d  ON d.id = ea.department_id AND d.company_id = $1
  LEFT JOIN job_categories jc ON jc.id = ea.job_category_id AND jc.company_id = $1
  WHERE ea.company_id = $1
    AND ea.is_primary = true
    AND ea.end_date IS NULL
    AND ea.effective_date <= $2::date
    AND ea.status IN ('ACTIVE','ON_LEAVE')
  ORDER BY ea.employee_id, ea.effective_date DESC, ea.id DESC
)`

const ROSTER_QUERY = `WITH ${ROSTER_CTE}
SELECT employee_id, department_id, department_name, job_category_code FROM roster`

// 회사 현지 달력일. naive timestamp(work_date·holiday·leave·hire 등)은 "현지자정-as-UTC wall-clock"으로
// 저장 → UTC로 해석 후 $4(tz)로 변환해야 정확한 현지 date (PR-4 clock_in 컨벤션). LOA·effective_date는 @db.Date라 변환 불요.
const localDate = (col: string) => `((${col} AT TIME ZONE 'UTC') AT TIME ZONE $4)::date`

/** 직원-기간 피더. groupByYm=true → 12개월(월별 ym), false → 30일(ym=NULL 단일 윈도우). $4=tz. */
function buildFeederSql(groupByYm: boolean): string {
  const ymExpr = groupByYm ? `to_char(c.d, 'YYYY-MM')` : `NULL::text`
  return `WITH ${ROSTER_CTE},
cal AS (
  SELECT generate_series($3::date, $2::date - 1, interval '1 day')::date AS d
),
leave_by_day AS (
  SELECT lr.employee_id, g.d::date AS d,
    LEAST(1.0, SUM(CASE WHEN lr.half_day_type IN ('AM','PM')
                         AND ${localDate('lr.start_date')} = ${localDate('lr.end_date')} THEN 0.5 ELSE 1.0 END)) AS frac
  FROM leave_requests lr
  JOIN roster r ON r.employee_id = lr.employee_id
  CROSS JOIN LATERAL generate_series(
    GREATEST(${localDate('lr.start_date')}, $3::date),
    LEAST(${localDate('lr.end_date')}, $2::date - 1), interval '1 day') g(d)
  WHERE lr.company_id = $1 AND lr.status = 'APPROVED'
    AND ${localDate('lr.end_date')} >= $3::date AND ${localDate('lr.start_date')} < $2::date
  GROUP BY lr.employee_id, g.d::date
),
eligible AS (
  SELECT r.employee_id, r.department_id, r.job_category_code, c.d, ${ymExpr} AS ym
  FROM roster r CROSS JOIN cal c
  WHERE EXTRACT(DOW FROM c.d) NOT IN (0,6)
    AND c.d >= ${localDate('r.hire_date')}
    AND (r.resign_date IS NULL OR c.d <= ${localDate('r.resign_date')})
    AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.company_id = $1 AND ${localDate('h.date')} = c.d)
    AND NOT EXISTS (SELECT 1 FROM designated_leave_days dl WHERE dl.company_id = $1 AND ${localDate('dl.date')} = c.d)
    AND NOT EXISTS (
      SELECT 1 FROM leave_of_absences loa
      WHERE loa.company_id = $1 AND loa.employee_id = r.employee_id AND loa.deleted_at IS NULL
        AND loa.status IN ('APPROVED','ACTIVE','RETURN_REQUESTED','COMPLETED')
        AND c.d >= loa.start_date
        AND c.d <= (CASE
          WHEN loa.status IN ('ACTIVE','RETURN_REQUESTED') THEN $2::date
          WHEN loa.status = 'COMPLETED' THEN COALESCE(loa.actual_end_date, loa.expected_end_date, $2::date)
          ELSE COALESCE(loa.expected_end_date, $2::date) END)
    )
)
SELECT
  el.department_id,
  el.job_category_code,
  el.employee_id,
  el.ym,
  COUNT(*)::int AS elig_days,
  COALESCE(SUM(lbd.frac), 0)::float8 AS leave_days,
  COUNT(*) FILTER (WHERE a.status = 'NORMAL')::int AS normal_elig,
  COUNT(*) FILTER (WHERE a.status IN ('NORMAL','LATE','EARLY_OUT'))::int AS present_elig
FROM eligible el
LEFT JOIN leave_by_day lbd ON lbd.employee_id = el.employee_id AND lbd.d = el.d
LEFT JOIN attendances a ON a.employee_id = el.employee_id AND a.company_id = $1
  AND a.work_date >= $3::timestamp - interval '1 day' AND a.work_date < $2::timestamp + interval '1 day'
  AND ${localDate('a.work_date')} = el.d
GROUP BY el.department_id, el.job_category_code, el.employee_id, el.ym`
}

const FEEDER_TREND_SQL = buildFeederSql(true)
const FEEDER_DEPT_SQL = buildFeederSql(false)

// ─── Orchestration ──────────────────────────────────────────

export async function getAttendanceRate(companyId: string, now: Date): Promise<AttendanceRate> {
  const setting = await prisma.attendanceSetting.findUnique({
    where: { companyId },
    select: { timezone: true, shiftEnabled: true, standardDaysPerWeek: true },
  })
  const timezone = setting?.timezone ?? DEFAULT_TIMEZONE
  const shiftEnabled = setting?.shiftEnabled ?? false
  const daysPerWeek = setting?.standardDaysPerWeek ?? STANDARD_DAYS_PER_WEEK
  const today = formatToTz(now, timezone, 'yyyy-MM-dd')
  const months = monthRange(today, TREND_MONTHS)

  // roster 는 support 무관하게 항상 (부서 universe·headcount·classMix·미분류)
  const rosterRows = await prisma.$queryRawUnsafe<RosterRow[]>(ROSTER_QUERY, companyId, today)

  const rosterDepts = new Map<string, RosterDept>()
  let management = 0
  let production = 0
  let unclassifiedCount = 0
  for (const r of rosterRows) {
    if (r.job_category_code == null) unclassifiedCount++
    if (formulaForJobCategory(r.job_category_code) === 'STRICT') production++
    else management++
    if (r.department_id) {
      const cur = rosterDepts.get(r.department_id)
      if (cur) cur.rosterCount++
      else rosterDepts.set(r.department_id, { departmentName: r.department_name ?? '—', rosterCount: 1 })
    }
  }

  const reason: RateMeta['reason'] = shiftEnabled
    ? 'SHIFT'
    : daysPerWeek !== STANDARD_DAYS_PER_WEEK
      ? 'NON_STANDARD_WEEK'
      : null
  const supported = reason === null

  const baseMeta: RateMeta = {
    supported,
    reason,
    cohortMin: DEFAULT_COHORT_MIN,
    rosterCount: rosterRows.length,
    unclassifiedCount,
    anomalyCount: 0,
    classMix: { management, production },
    basisNote: 'CURRENT_ROSTER',
  }

  if (!supported) {
    return {
      rosterDepts,
      deptRates: new Map(),
      rateTrend: months.map((month) => ({
        month,
        management: UNSUPPORTED_POINT,
        production: UNSUPPORTED_POINT,
      })),
      rateMeta: baseMeta,
    }
  }

  const trendStart = firstDayMonthsAgo(today, TREND_MONTHS - 1)
  const deptStart = addDaysStr(today, -(DEPT_WINDOW_DAYS - 1))

  const [trendRows, deptFeedRows] = await Promise.all([
    prisma.$queryRawUnsafe<FeederRow[]>(FEEDER_TREND_SQL, companyId, today, trendStart, timezone),
    prisma.$queryRawUnsafe<FeederRow[]>(FEEDER_DEPT_SQL, companyId, today, deptStart, timezone),
  ])

  // ── 12개월 추세: 월·직군군별 pairs → aggregate ──
  let anomalyCount = 0
  const trendByMonth = new Map<string, { mgmt: EmployeePair[]; prod: EmployeePair[] }>()
  for (const m of months) trendByMonth.set(m, { mgmt: [], prod: [] })
  for (const row of trendRows) {
    if (!row.ym) continue
    const bucket = trendByMonth.get(row.ym)
    if (!bucket) continue
    const formula = formulaForJobCategory(row.job_category_code)
    const pair = employeePair(formula, {
      eligDays: Number(row.elig_days),
      leaveDays: Number(row.leave_days),
      normalElig: Number(row.normal_elig),
      presentElig: Number(row.present_elig),
    })
    if (pair.clamped) anomalyCount++
    if (formula === 'STRICT') bucket.prod.push(pair)
    else bucket.mgmt.push(pair)
  }
  const rateTrend: RateTrendMonth[] = months.map((month) => {
    const b = trendByMonth.get(month)!
    return { month, management: aggregate(b.mgmt), production: aggregate(b.prod) }
  })

  // ── 30일 부서별: dept(NOT NULL)별 pairs → aggregate (혼합) ──
  const deptPairs = new Map<string, EmployeePair[]>()
  for (const row of deptFeedRows) {
    if (!row.department_id) continue // 미배정은 부서 칸 제외(추세엔 포함됨)
    const formula = formulaForJobCategory(row.job_category_code)
    const pair = employeePair(formula, {
      eligDays: Number(row.elig_days),
      leaveDays: Number(row.leave_days),
      normalElig: Number(row.normal_elig),
      presentElig: Number(row.present_elig),
    })
    const arr = deptPairs.get(row.department_id)
    if (arr) arr.push(pair)
    else deptPairs.set(row.department_id, [pair])
  }
  const deptRates = new Map<string, RatePoint>()
  for (const [deptId, pairs] of deptPairs) deptRates.set(deptId, aggregate(pairs))

  return {
    rosterDepts,
    deptRates,
    rateTrend,
    rateMeta: { ...baseMeta, anomalyCount },
  }
}
