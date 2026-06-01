import { describe, it, expect } from 'vitest'
import {
  aggregateMonthlyStats,
  countLate,
  EMPTY_TIME,
  type MonthlyAggregateDay,
  type MonthlyAggregateSummary,
} from '@/lib/attendance/monthly-aggregate'

// tz = 'Asia/Seoul' (UTC+9). ISO(UTC) → KST time-of-day.
// 2026-05-01T23:50Z = 2026-05-02 08:50 KST ; 2026-05-02T00:10Z = 09:10 KST
const KST = 'Asia/Seoul'

function day(
  status: string | null,
  clockIn: string | null,
  clockOut: string | null,
): MonthlyAggregateDay {
  return { status, clockIn, clockOut }
}

describe('aggregateMonthlyStats — (a) 정상 5지표 집계', () => {
  const days: MonthlyAggregateDay[] = [
    // KST 08:50 in / 18:40 out
    day('NORMAL', '2026-05-01T23:50:00.000Z', '2026-05-02T09:40:00.000Z'),
    // KST 09:10 in / 18:50 out, LATE
    day('LATE', '2026-05-02T00:10:00.000Z', '2026-05-02T09:50:00.000Z'),
  ]
  const summary: MonthlyAggregateSummary = { workedDays: 2, totalOvertimeMinutes: 126 }
  const r = aggregateMonthlyStats(days, summary, KST)

  it('① workDays = summary.workedDays', () => {
    expect(r.workDays).toBe(2)
  })
  it('② avgClockIn = KST time-of-day 분 평균 (08:50,09:10 → 09:00)', () => {
    expect(r.avgClockIn).toBe('09:00')
  })
  it('③ avgClockOut = (18:40,18:50 → 18:45)', () => {
    expect(r.avgClockOut).toBe('18:45')
  })
  it('④ overtimeTotalHours = 126/60 = 2.1 (소수1 반올림)', () => {
    expect(r.overtimeTotalHours).toBe(2.1)
  })
  it('⑤ lateCount = status LATE 카운트', () => {
    expect(r.lateCount).toBe(1)
  })
})

describe('aggregateMonthlyStats — (b) clockIn/Out 일부 null', () => {
  it('평균 = 비-null 만 (null 제외)', () => {
    const days = [
      day('NORMAL', '2026-05-01T23:50:00.000Z', null), // 08:50 in, out null
      day('NORMAL', null, '2026-05-02T09:50:00.000Z'), // in null, 18:50 out
    ]
    const r = aggregateMonthlyStats(days, { workedDays: 2, totalOvertimeMinutes: 0 }, KST)
    expect(r.avgClockIn).toBe('08:50') // 단일 비-null
    expect(r.avgClockOut).toBe('18:50')
  })
})

describe('aggregateMonthlyStats — (c) 모든 clockIn/Out null', () => {
  it('빈 표현 EMPTY_TIME', () => {
    const days = [day('ABSENT', null, null), day('ABSENT', null, null)]
    const r = aggregateMonthlyStats(days, { workedDays: 0, totalOvertimeMinutes: 0 }, KST)
    expect(r.avgClockIn).toBe(EMPTY_TIME)
    expect(r.avgClockOut).toBe(EMPTY_TIME)
    expect(r.avgClockIn).toBe('--:--')
  })
})

describe('aggregateMonthlyStats — (d) overtime ÷60 소수 처리', () => {
  it('90분 → 1.5h', () => {
    const r = aggregateMonthlyStats([], { workedDays: 0, totalOvertimeMinutes: 90 }, KST)
    expect(r.overtimeTotalHours).toBe(1.5)
  })
  it('125분 → 2.1h (반올림 소수1)', () => {
    const r = aggregateMonthlyStats([], { workedDays: 0, totalOvertimeMinutes: 125 }, KST)
    expect(r.overtimeTotalHours).toBe(2.1)
  })
  it('0분 → 0', () => {
    const r = aggregateMonthlyStats([], { workedDays: 0, totalOvertimeMinutes: 0 }, KST)
    expect(r.overtimeTotalHours).toBe(0)
  })
})

describe('countLate — (e) status LATE 카운트', () => {
  it('LATE 만 카운트 (NORMAL/ABSENT/null 제외)', () => {
    expect(
      countLate([
        { status: 'LATE' },
        { status: 'NORMAL' },
        { status: 'LATE' },
        { status: 'ABSENT' },
        { status: null },
      ]),
    ).toBe(2)
  })
  it('빈 배열 → 0', () => {
    expect(countLate([])).toBe(0)
  })
})
