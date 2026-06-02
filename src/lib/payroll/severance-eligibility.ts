// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 퇴직금 자격 판정 (근로자퇴직급여보장법 §4①)
// §4① 단서: 계속근로기간 1년 미만 OR 4주 평균 1주 소정근로시간
//          15시간 미만 근로자는 법정 퇴직급여 대상에서 제외.
// 순수 함수 (DB 무의존) — 단위 테스트 대상.
// ═══════════════════════════════════════════════════════════

// 자격 미달 사유 / 경고 상수 (테스트는 상수 참조 — 문자열 결합 회피)
export const SEVERANCE_REASON_TENURE =
  '계속근로기간 1년 미만 (근로자퇴직급여보장법 §4①)'
export const SEVERANCE_REASON_WEEKLY_HOURS =
  '4주 평균 1주 소정근로시간 15시간 미만 (근로자퇴직급여보장법 §4①)'
export const SEVERANCE_WARN_NO_SCHEDULE =
  '근로시간 스케줄 미지정/불완전 — 주 15시간 요건 미검증 (인사담당자 수동 확인 필요)'

const FOUR_WEEK_DAYS = 28
const MIN_WEEKLY_HOURS = 15
const MIN_TENURE_DAYS = 365
const DAY_MS = 24 * 60 * 60 * 1000

// ─── Types ──────────────────────────────────────────────────

export interface ScheduleWindowInput {
  id: string
  effectiveFrom: Date
  effectiveTo: Date | null
  weeklyHours: number
}

export interface FourWeekAvgResult {
  avgWeeklyHours: number | null
  coveredDays: number
}

export interface SeveranceEligibilityResult {
  eligible: boolean
  reason: string | null
  warning: string | null
}

// ─── Helpers ────────────────────────────────────────────────

/** UTC 자정 기준 날짜(epoch ms) — 시각/타임존 노이즈 제거 */
function dayStartUtc(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

// ─── Public API ─────────────────────────────────────────────

/**
 * 퇴직일 직전 4주(28일) 윈도 `[termDate-28d, termDate)` 와 교차하는
 * 스케줄들의 일수가중 평균 소정근로시간을 계산.
 *
 * - 퇴직일 당일은 윈도에서 제외 (직전 28일만)
 * - 한 날짜에 복수 스케줄이 적용되면 `effectiveFrom` 최신 → `id` asc 로
 *   tie-break (가장 최근 배정 우선, 결정적)
 * - `effectiveTo` 는 inclusive (해당일 종일 적용)
 * - **28일 전부 커버되지 않으면** `avgWeeklyHours = null` (불완전 데이터로
 *   4주 평균을 신뢰할 수 없음 → 자동 제외/포함 대신 unknown 으로 표기,
 *   상위에서 감사 경고 후 인사담당자 수동 검증). 부분 커버 일수만으로
 *   나누면 평균 과대, 0-fill 은 부당 제외 위험 → 양쪽 모두 회피.
 */
export function computeTrailingFourWeekAvgWeeklyHours(
  schedules: ScheduleWindowInput[],
  terminationDate: Date,
): FourWeekAvgResult {
  const termDay = dayStartUtc(terminationDate)
  let sum = 0
  let covered = 0

  for (let i = 1; i <= FOUR_WEEK_DAYS; i++) {
    const day = termDay - i * DAY_MS // i=1..28 → 퇴직일 직전 28일 (당일 제외)

    const applicable = schedules
      .filter((s) => {
        const from = dayStartUtc(s.effectiveFrom)
        if (from > day) return false
        if (s.effectiveTo == null) return true
        return day <= dayStartUtc(s.effectiveTo) // inclusive
      })
      .sort((a, b) => {
        const fa = dayStartUtc(a.effectiveFrom)
        const fb = dayStartUtc(b.effectiveFrom)
        if (fa !== fb) return fb - fa // effectiveFrom desc (최신 우선)
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0 // id asc
      })

    if (applicable.length === 0) continue
    sum += applicable[0].weeklyHours
    covered++
  }

  // 28일 전부 커버되어야 4주 평균을 신뢰. 부분 커버는 unknown(null).
  if (covered < FOUR_WEEK_DAYS) return { avgWeeklyHours: null, coveredDays: covered }
  return { avgWeeklyHours: sum / covered, coveredDays: covered }
}

/**
 * 근로자퇴직급여보장법 §4① 단서 자격 판정.
 * 자격 boolean 만 판정 — 반복형 단시간 근로자의 계속근로기간 재산정은
 * 별도 산정엔진 트랙(본 모듈 범위 밖).
 */
export function evaluateSeveranceEligibility(input: {
  tenureDays: number
  avgWeeklyHours: number | null
}): SeveranceEligibilityResult {
  if (input.tenureDays < MIN_TENURE_DAYS) {
    return { eligible: false, reason: SEVERANCE_REASON_TENURE, warning: null }
  }
  // 스케줄 미지정 → 시간 사유로 자동 제외하지 않음 (법정급여 부당박탈 방지).
  // 대신 감사 추적용 경고를 reason 과 구분해 노출.
  if (input.avgWeeklyHours == null) {
    return { eligible: true, reason: null, warning: SEVERANCE_WARN_NO_SCHEDULE }
  }
  if (input.avgWeeklyHours < MIN_WEEKLY_HOURS) {
    return { eligible: false, reason: SEVERANCE_REASON_WEEKLY_HOURS, warning: null }
  }
  return { eligible: true, reason: null, warning: null }
}
