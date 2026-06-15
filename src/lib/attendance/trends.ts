// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance Trends Aggregation (PR-4)
// HR 추세 탭 데이터 — 전부 Attendance/LeaveRequest 행 기반 grouped SQL.
// 출근율%(분모 eligibility)는 PR-4b 분리 — 여기엔 운영지표만.
//   A) 부서별 30일 비교  B) 출근시각 분포 30일  C) 근태유형 추이 6개월
// 멀티테넌트: 모든 쿼리 company_id 필터 + 부서 JOIN은 동일 법인 active-primary 1건.
// TZ: clock_in/out·work_date·start_date 등 naive timestamp 는 저장 instant 충실 복원 위해
//     (… AT TIME ZONE 'UTC') AT TIME ZONE $tz 로 현지 달력일/시각 변환 (rate.ts localDate SSOT 정합).
//     bare ::date / date_trunc(work_date) 는 KST자정-시드 행에서 하루 어긋남 (rate.ts 와 윈도우 불일치).
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { formatToTz } from '@/lib/timezone'
import { getAttendanceRate, type RateTrendMonth, type RateMeta } from './rate'

const DEFAULT_TIMEZONE = 'Asia/Seoul'
const DEFAULT_WORK_START = '08:30'
const WINDOW_DAYS = 30 // 부서비교·히스토그램 윈도우
const TREND_MONTHS = 6 // 유형추이 윈도우
const COHORT_MIN = 5 // 개인 식별 방지 — 부서·지표별 최소 기여자 수 (Codex r2-2)
const BUCKET_SECONDS = 900 // 15분

// ─── Types ──────────────────────────────────────────────────

export interface DeptTrendRow {
  departmentId: string
  departmentName: string
  employeeCount: number
  lateCount: number
  absentCount: number
  // 기여자 < COHORT_MIN 이면 null (개인 추론 차단)
  avgClockIn: string | null // "HH:mm" 회사 현지
  avgClockOut: string | null
  avgOvertimeHours: number | null
  // 출근율 (PR-4b, 30일 혼합 — 직군 공식; null=미산출/억제, rate-point 계약)
  attendanceRate: number | null // %
  attendanceRateDenom: number | null
  attendanceRateCohort: number
  attendanceRateSuppressed: boolean
}

export interface ArrivalBucket {
  /** 버킷 시작 "HH:mm" (현지), 또는 'before'/'after' 오버플로 */
  label: string
  count: number
  /** 기준 출근시각 이후 버킷인지 (참고용 — 개인 지각 판정 아님) */
  afterStart: boolean
}

export interface TypeTrendRow {
  month: string // "YYYY-MM"
  normal: number
  late: number
  earlyOut: number
  absent: number
  leaveRequests: number // 해당 월 시작 승인 휴가 건수
}

export interface AttendanceTrends {
  timezone: string
  cohortMin: number
  window: { deptStart: string; deptEnd: string; trendStart: string }
  departments: DeptTrendRow[]
  arrival: {
    /** 교대제 법인은 null (기준선 무의미) */
    workStartTime: string | null
    shiftEnabled: boolean
    buckets: ArrivalBucket[]
  }
  typeTrend: TypeTrendRow[]
  // 출근율 (PR-4b)
  rateTrend: RateTrendMonth[] // 12개월 직군별 2선
  rateMeta: RateMeta
}

// ─── Pure helpers (단위 테스트 대상) ─────────────────────────

/** YYYY-MM-DD + n일 (UTC 연산 — 서버 tz drift 회피) */
export function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** localDateStr이 속한 달의 n개월 전 1일 (YYYY-MM-DD). n<0 이면 이후 달. */
export function firstDayMonthsAgo(localDateStr: string, n: number): string {
  const [y, m] = localDateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 - n, 1)).toISOString().slice(0, 10)
}

/** localDateStr 기준 최근 count개월 "YYYY-MM" (오름차순 — 데이터 없는 월도 포함) */
export function monthRange(localDateStr: string, count: number): string[] {
  const out: string[] = []
  for (let i = count - 1; i >= 0; i--) out.push(firstDayMonthsAgo(localDateStr, i).slice(0, 7))
  return out
}

/** 자정 이후 초 → "HH:mm" (0..86399; 음수/NaN/null → null) */
export function secondsToHHmm(sec: number | null): string | null {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return null
  const total = Math.round(sec / 60)
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** "HH:mm" → 자정 이후 초 (파싱 실패 → null) */
export function hhmmToSeconds(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 3600 + min * 60
}

/** 15분 버킷 인덱스(0..95) 카운트 맵 → 표시 버킷 배열 (희소 버킷은 before/after 오버플로로 병합) */
export function buildArrivalBuckets(
  rawByBucket: Map<number, number>,
  workStartSec: number | null,
): ArrivalBucket[] {
  // 표시 범위: 기준 출근시각 ±90분 (없으면 08:30 중심). 그 밖은 before/after 로 합산.
  const centerSec = workStartSec ?? 8 * 3600 + 30 * 60
  const firstBucket = Math.max(0, Math.floor((centerSec - 90 * 60) / BUCKET_SECONDS))
  const lastBucket = Math.min(95, Math.floor((centerSec + 90 * 60) / BUCKET_SECONDS))

  let before = 0
  let after = 0
  for (const [bucket, count] of rawByBucket) {
    if (bucket < firstBucket) before += count
    else if (bucket > lastBucket) after += count
  }
  const mid: ArrivalBucket[] = []
  for (let b = firstBucket; b <= lastBucket; b++) {
    const startSec = b * BUCKET_SECONDS
    mid.push({
      label: secondsToHHmm(startSec)!,
      count: rawByBucket.get(b) ?? 0,
      afterStart: workStartSec != null && startSec >= workStartSec,
    })
  }
  const out: ArrivalBucket[] = []
  if (before > 0) out.push({ label: 'before', count: before, afterStart: false })
  out.push(...mid)
  if (after > 0) out.push({ label: 'after', count: after, afterStart: true })
  return out
}

// ─── Orchestration ──────────────────────────────────────────

export async function getAttendanceTrends(companyId: string, now: Date): Promise<AttendanceTrends> {
  // 법인 컨텍스트 (tz·기준출근시각·교대여부) — 1쿼리
  const setting = await prisma.attendanceSetting.findUnique({
    where: { companyId },
    select: { timezone: true, workStartTime: true, shiftEnabled: true },
  })
  const timezone = setting?.timezone ?? DEFAULT_TIMEZONE
  const shiftEnabled = setting?.shiftEnabled ?? false
  const workStartTime = setting?.workStartTime ?? DEFAULT_WORK_START
  const localDateStr = formatToTz(now, timezone, 'yyyy-MM-dd')

  // 윈도우 (회사 현지 date-only 문자열 → SQL 에서 ::date/::timestamp 캐스팅).
  // 행 필터는 인덱스 보존 raw instant prefilter(±1d) + localDate(현지 달력일) residual 병용.
  const deptEndStr = addDaysStr(localDateStr, 1) // 오늘 포함 (exclusive 상한)
  const deptStartStr = addDaysStr(localDateStr, -(WINDOW_DAYS - 1))
  const trendStartStr = firstDayMonthsAgo(localDateStr, TREND_MONTHS - 1)
  const trendEndStr = firstDayMonthsAgo(localDateStr, -1) // 다음 달 1일 — 미래 월 제외 (Codex Gate2 P1-1)

  // PR-4b 출근율 엔진 — 운영지표 쿼리와 병렬
  const ratePromise = getAttendanceRate(companyId, now)

  const [deptRows, arrivalRows, typeRows, leaveRows] = await Promise.all([
    // ── A) 부서별 30일 ── DISTINCT ON(LATERAL LIMIT 1)으로 직원당 active-primary 1건 (행 배증 방지, Codex r2-4)
    prisma.$queryRaw<Array<{
      department_id: string
      department_name: string
      employee_count: number
      late_count: number
      absent_count: number
      avg_in_sec: number | null
      in_contributors: number
      avg_out_sec: number | null
      out_contributors: number
      avg_ot_min: number | null
      ot_contributors: number
    }>>`
      SELECT
        d.id AS department_id,
        d.name AS department_name,
        COUNT(DISTINCT a.employee_id)::int AS employee_count,
        COUNT(*) FILTER (WHERE a.status = 'LATE')::int AS late_count,
        COUNT(*) FILTER (WHERE a.status = 'ABSENT')::int AS absent_count,
        (AVG(EXTRACT(EPOCH FROM ((a.clock_in AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::time))
          FILTER (WHERE a.clock_in IS NOT NULL))::float8 AS avg_in_sec,
        COUNT(DISTINCT a.employee_id) FILTER (WHERE a.clock_in IS NOT NULL)::int AS in_contributors,
        (AVG(EXTRACT(EPOCH FROM ((a.clock_out AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::time))
          FILTER (WHERE a.clock_out IS NOT NULL))::float8 AS avg_out_sec,
        COUNT(DISTINCT a.employee_id) FILTER (WHERE a.clock_out IS NOT NULL)::int AS out_contributors,
        (AVG(a.overtime_minutes) FILTER (WHERE a.overtime_minutes IS NOT NULL))::float8 AS avg_ot_min,
        COUNT(DISTINCT a.employee_id) FILTER (WHERE a.overtime_minutes IS NOT NULL)::int AS ot_contributors
      FROM attendances a
      JOIN LATERAL (
        SELECT ea.department_id
        FROM employee_assignments ea
        WHERE ea.employee_id = a.employee_id
          AND ea.company_id = ${companyId}
          AND ea.is_primary = true
          AND ea.end_date IS NULL
          AND ea.effective_date <= ${now}
        ORDER BY ea.effective_date DESC, ea.id DESC
        LIMIT 1
      ) ea ON true
      JOIN departments d ON d.id = ea.department_id AND d.company_id = ${companyId}
      WHERE a.company_id = ${companyId}
        AND a.work_date >= ${deptStartStr}::timestamp - interval '1 day'
        AND a.work_date <  ${deptEndStr}::timestamp + interval '1 day'
        AND ((a.work_date AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::date >= ${deptStartStr}::date
        AND ((a.work_date AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::date <  ${deptEndStr}::date
      GROUP BY d.id, d.name
      ORDER BY d.name`,
    // ── B) 출근시각 분포 30일 ── 15분 버킷
    prisma.$queryRaw<Array<{ bucket: number; cnt: number }>>`
      SELECT
        FLOOR(EXTRACT(EPOCH FROM ((a.clock_in AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::time) / ${BUCKET_SECONDS})::int AS bucket,
        COUNT(*)::int AS cnt
      FROM attendances a
      WHERE a.company_id = ${companyId}
        AND a.work_date >= ${deptStartStr}::timestamp - interval '1 day'
        AND a.work_date <  ${deptEndStr}::timestamp + interval '1 day'
        AND ((a.work_date AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::date >= ${deptStartStr}::date
        AND ((a.work_date AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::date <  ${deptEndStr}::date
        AND a.clock_in IS NOT NULL
      GROUP BY bucket
      ORDER BY bucket`,
    // ── C) 근태유형 월별 카운트 6개월 ── work_date 현지 달력일 = localDate (KST자정-시드 off-by-one 해소)
    prisma.$queryRaw<Array<{ month: string; status: string; cnt: number }>>`
      SELECT
        to_char(date_trunc('month', (a.work_date AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}), 'YYYY-MM') AS month,
        a.status::text AS status,
        COUNT(*)::int AS cnt
      FROM attendances a
      WHERE a.company_id = ${companyId}
        AND a.work_date >= ${trendStartStr}::timestamp - interval '1 day'
        AND a.work_date <  ${trendEndStr}::timestamp + interval '1 day'
        AND ((a.work_date AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::date >= ${trendStartStr}::date
        AND ((a.work_date AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::date <  ${trendEndStr}::date
      GROUP BY month, a.status
      ORDER BY month`,
    // ── C) 휴가 월별 승인건수 (startDate 월 귀속 — 일배분 회피, Codex r2-3) — localDate 정합
    prisma.$queryRaw<Array<{ month: string; cnt: number }>>`
      SELECT
        to_char(date_trunc('month', (lr.start_date AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}), 'YYYY-MM') AS month,
        COUNT(*)::int AS cnt
      FROM leave_requests lr
      WHERE lr.company_id = ${companyId}
        AND lr.status = 'APPROVED'
        AND lr.start_date >= ${trendStartStr}::timestamp - interval '1 day'
        AND lr.start_date <  ${trendEndStr}::timestamp + interval '1 day'
        AND ((lr.start_date AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::date >= ${trendStartStr}::date
        AND ((lr.start_date AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::date <  ${trendEndStr}::date
      GROUP BY month
      ORDER BY month`,
  ])

  // ── A 조립: 부서 universe = roster ∪ attendance (저출근 부서도 유지, Codex r1-P1-4) ──
  // employeeCount = roster headcount(우선) → 운영지표는 attendance 행에서 LEFT-merge(없으면 0/null).
  // 부서 표시 cohort 게이트(개인 추론 차단)는 유지(headcount ≥ COHORT_MIN). 출근율 억제는 별도(rate-point).
  const rate = await ratePromise
  const attByDept = new Map(deptRows.map((r) => [r.department_id, r]))
  const deptIds = new Set<string>([...rate.rosterDepts.keys(), ...deptRows.map((r) => r.department_id)])
  const departments: DeptTrendRow[] = [...deptIds]
    .map((deptId): DeptTrendRow | null => {
      const att = attByDept.get(deptId)
      const rosterDept = rate.rosterDepts.get(deptId)
      const employeeCount = rosterDept ? rosterDept.rosterCount : Number(att?.employee_count ?? 0)
      if (employeeCount < COHORT_MIN) return null
      const ratePoint = rate.deptRates.get(deptId)
      return {
        departmentId: deptId,
        departmentName: rosterDept?.departmentName ?? att?.department_name ?? '—',
        employeeCount,
        lateCount: att ? Number(att.late_count) : 0,
        absentCount: att ? Number(att.absent_count) : 0,
        // 교대제 법인은 평균 출퇴근 무의미(야간 wrap) → null. 비교대도 지표별 기여자 5+ 일 때만.
        avgClockIn:
          att && !shiftEnabled && Number(att.in_contributors) >= COHORT_MIN
            ? secondsToHHmm(att.avg_in_sec == null ? null : Number(att.avg_in_sec))
            : null,
        avgClockOut:
          att && !shiftEnabled && Number(att.out_contributors) >= COHORT_MIN
            ? secondsToHHmm(att.avg_out_sec == null ? null : Number(att.avg_out_sec))
            : null,
        avgOvertimeHours:
          att && Number(att.ot_contributors) >= COHORT_MIN && att.avg_ot_min != null
            ? Math.round((Number(att.avg_ot_min) / 60) * 10) / 10
            : null,
        attendanceRate: ratePoint?.rate ?? null,
        attendanceRateDenom: ratePoint?.denom ?? null,
        attendanceRateCohort: ratePoint?.cohort ?? 0,
        attendanceRateSuppressed: ratePoint?.suppressed ?? false,
      }
    })
    .filter((d): d is DeptTrendRow => d !== null)
    .sort((a, b) => a.departmentName.localeCompare(b.departmentName))

  // ── B 조립: 버킷 맵 → 표시 버킷 ──
  const rawByBucket = new Map<number, number>()
  for (const row of arrivalRows) rawByBucket.set(Number(row.bucket), Number(row.cnt))
  const workStartSec = hhmmToSeconds(workStartTime)
  const buckets = buildArrivalBuckets(rawByBucket, shiftEnabled ? null : workStartSec)

  // ── C 조립: 6개월 zero-fill 후 status pivot + 휴가 병합 (Codex Gate2 P1-2) ──
  const monthMap = new Map<string, TypeTrendRow>()
  for (const month of monthRange(localDateStr, TREND_MONTHS)) {
    monthMap.set(month, { month, normal: 0, late: 0, earlyOut: 0, absent: 0, leaveRequests: 0 })
  }
  for (const r of typeRows) {
    const row = monthMap.get(r.month)
    if (!row) continue // 윈도우 밖 (상한으로 차단되나 방어)
    const cnt = Number(r.cnt)
    if (r.status === 'NORMAL') row.normal += cnt
    else if (r.status === 'LATE') row.late += cnt
    else if (r.status === 'EARLY_OUT') row.earlyOut += cnt
    else if (r.status === 'ABSENT') row.absent += cnt
  }
  for (const r of leaveRows) {
    const row = monthMap.get(r.month)
    if (row) row.leaveRequests += Number(r.cnt)
  }
  const typeTrend = [...monthMap.values()] // 삽입 순서 = 오름차순 6개월

  return {
    timezone,
    cohortMin: COHORT_MIN,
    window: { deptStart: deptStartStr, deptEnd: deptEndStr, trendStart: trendStartStr },
    departments,
    arrival: {
      workStartTime: shiftEnabled ? null : workStartTime,
      shiftEnabled,
      buckets,
    },
    typeTrend,
    rateTrend: rate.rateTrend,
    rateMeta: rate.rateMeta,
  }
}
