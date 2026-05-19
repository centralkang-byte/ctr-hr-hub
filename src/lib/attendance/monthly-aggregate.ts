// ═══════════════════════════════════════════════════════════
// CTR HR Hub — monthly-aggregate (Phase 3a Stage5 PR-4, AT-005)
// monthly API 응답(days[]+summary) → WdMonthlyStatInput 클라이언트 집계.
// 순수 함수 (no side effect). monthly API 무변경(F18) = read-only 변환.
// 시각 평균: tz 보정(formatToTz SSOT, F17) 후 "분-of-day" 산술평균
//   — 절대 epoch 평균은 날짜 혼합 시 time-of-day 왜곡 → 분 단위로 집계.
// ═══════════════════════════════════════════════════════════

import { formatToTz } from '@/lib/timezone'
import type { WdMonthlyStatInput } from '@/components/shared/WdMonthlyStatCard'

// 회사 tz fallback (notifications.ts:150 / calendar-scheduler 동형 선례)
const DEFAULT_TZ = 'Asia/Seoul'

/** clockIn/Out 전부 null 인 빈 표현 (WdMonthlyStatCard 행 표시 정합) */
export const EMPTY_TIME = '--:--'

/** monthly API days[] 부분집합 (집계 소비 필드만, read-only) */
export interface MonthlyAggregateDay {
  status: string | null
  clockIn: string | null
  clockOut: string | null
}

/** monthly API summary 부분집합 (집계 소비 필드만) */
export interface MonthlyAggregateSummary {
  workedDays: number
  totalOvertimeMinutes: number
}

/**
 * tz 보정 후 time-of-day(분) 산술평균 → "HH:mm".
 * null 제외. 전부 null → EMPTY_TIME.
 * F17: tz 변환은 formatToTz SSOT 만 사용 (인라인 toLocaleTimeString 없음).
 */
function averageTimeOfDay(times: (string | null)[], timezone: string): string {
  const minutes: number[] = []
  for (const t of times) {
    if (!t) continue
    const hhmm = formatToTz(new Date(t), timezone, 'HH:mm')
    const [h, m] = hhmm.split(':').map(Number)
    if (Number.isFinite(h) && Number.isFinite(m)) minutes.push(h * 60 + m)
  }
  if (minutes.length === 0) return EMPTY_TIME
  const avg = Math.round(minutes.reduce((s, x) => s + x, 0) / minutes.length)
  const hh = String(Math.floor(avg / 60)).padStart(2, '0')
  const mm = String(avg % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

/** status === 'LATE' 일수 카운트 (지각) */
export function countLate(days: Pick<MonthlyAggregateDay, 'status'>[]): number {
  return days.filter((d) => d.status === 'LATE').length
}

/**
 * monthly API 응답 → WdMonthlyStatInput 5지표 집계 (클라이언트, F18 준수).
 * ① workDays=summary.workedDays ② avgClockIn ③ avgClockOut
 * ④ overtimeTotalHours=totalOvertimeMinutes/60(소수1) ⑤ lateCount
 */
export function aggregateMonthlyStats(
  days: MonthlyAggregateDay[],
  summary: MonthlyAggregateSummary,
  timezone: string = DEFAULT_TZ,
): WdMonthlyStatInput {
  return {
    workDays: summary.workedDays,
    avgClockIn: averageTimeOfDay(days.map((d) => d.clockIn), timezone),
    avgClockOut: averageTimeOfDay(days.map((d) => d.clockOut), timezone),
    overtimeTotalHours: Math.round((summary.totalOvertimeMinutes / 60) * 10) / 10,
    lateCount: countLate(days),
  }
}
