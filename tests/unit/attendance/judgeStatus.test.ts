import { describe, it, expect } from 'vitest'
import {
  hhmmToMinutes,
  isOvernight,
  addDaysToDateStr,
  workDateToDateStr,
  scheduleInstants,
  judgeAttendanceStatus,
  CLOCK_OUT_ATTACH_LIMIT_MS,
  DEFAULT_WORK_START,
  DEFAULT_WORK_END,
} from '@/lib/attendance/judgeStatus'
import { parseDateOnly } from '@/lib/timezone'

describe('hhmmToMinutes / isOvernight', () => {
  it('HH:mm → 분', () => {
    expect(hhmmToMinutes('08:30')).toBe(510)
    expect(hhmmToMinutes('00:00')).toBe(0)
    expect(hhmmToMinutes('23:59')).toBe(1439)
  })

  it('야간 교대 판정 — 종료 <= 시작이면 익일 종료', () => {
    expect(isOvernight('22:00', '06:00')).toBe(true)
    expect(isOvernight('08:30', '17:30')).toBe(false)
    expect(isOvernight('09:00', '09:00')).toBe(true) // 동일 시각 = 24h 교대로 해석
  })
})

describe('addDaysToDateStr / workDateToDateStr — UTC date-only 산술', () => {
  it('일수 가감 (월·윤년 경계 포함)', () => {
    expect(addDaysToDateStr('2026-06-10', 1)).toBe('2026-06-11')
    expect(addDaysToDateStr('2026-06-10', -1)).toBe('2026-06-09')
    expect(addDaysToDateStr('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDaysToDateStr('2024-02-28', 1)).toBe('2024-02-29') // 윤년
  })

  it('workDate(UTC 자정) ↔ 날짜 문자열 왕복', () => {
    expect(workDateToDateStr(parseDateOnly('2026-06-10'))).toBe('2026-06-10')
  })
})

describe('scheduleInstants — 로컬 날짜+HH:mm → 절대 시각', () => {
  it('Asia/Seoul 주간 (08:30~17:30)', () => {
    const { start, end } = scheduleInstants('2026-06-10', '08:30', '17:30', 'Asia/Seoul')
    expect(start.toISOString()).toBe('2026-06-09T23:30:00.000Z') // 08:30 KST
    expect(end.toISOString()).toBe('2026-06-10T08:30:00.000Z') // 17:30 KST
  })

  it('Asia/Seoul 야간 교대 (22:00~06:00) — 종료는 익일', () => {
    const { start, end } = scheduleInstants('2026-06-10', '22:00', '06:00', 'Asia/Seoul')
    expect(start.toISOString()).toBe('2026-06-10T13:00:00.000Z') // 22:00 KST
    expect(end.toISOString()).toBe('2026-06-10T21:00:00.000Z') // 익일 06:00 KST
  })

  it('America/Chicago DST 시작일 (2026-03-08) — CDT(UTC-5) 적용', () => {
    const { start, end } = scheduleInstants('2026-03-08', '08:30', '17:30', 'America/Chicago')
    expect(start.toISOString()).toBe('2026-03-08T13:30:00.000Z')
    expect(end.toISOString()).toBe('2026-03-08T22:30:00.000Z')
  })

  it('America/Chicago DST 종료일 (2026-11-01) — CST(UTC-6) 복귀', () => {
    const { start, end } = scheduleInstants('2026-11-01', '08:30', '17:30', 'America/Chicago')
    expect(start.toISOString()).toBe('2026-11-01T14:30:00.000Z')
    expect(end.toISOString()).toBe('2026-11-01T23:30:00.000Z')
  })

  it('DST 전환일의 nonexistent 시각도 결정적으로 해석 (throw 없음, end > start)', () => {
    // 2026-03-08 02:30은 Chicago에 존재하지 않는 시각 (02:00→03:00 스킵)
    const { start, end } = scheduleInstants('2026-03-08', '02:30', '11:30', 'America/Chicago')
    expect(Number.isNaN(start.getTime())).toBe(false)
    expect(end.getTime()).toBeGreaterThan(start.getTime())
  })
})

describe('judgeAttendanceStatus — 지각/조퇴 판정 (순수)', () => {
  // 기준: 2026-06-10 KST 08:30~17:30
  const { start, end } = scheduleInstants('2026-06-10', '08:30', '17:30', 'Asia/Seoul')
  const base = { scheduledStart: start, scheduledEnd: end }
  const at = (iso: string) => new Date(iso)

  it('정시 출퇴근 → NORMAL', () => {
    expect(
      judgeAttendanceStatus({
        ...base,
        clockIn: at('2026-06-09T23:00:00Z'), // 08:00 KST
        clockOut: at('2026-06-10T09:00:00Z'), // 18:00 KST
      }),
    ).toBe('NORMAL')
  })

  it('경계: clockIn == 예정 출근 → NORMAL (strict 비교)', () => {
    expect(judgeAttendanceStatus({ ...base, clockIn: start, clockOut: null })).toBe('NORMAL')
    expect(judgeAttendanceStatus({ ...base, clockIn: null, clockOut: end })).toBe('NORMAL')
  })

  it('1분이라도 늦으면 LATE', () => {
    expect(
      judgeAttendanceStatus({ ...base, clockIn: at('2026-06-09T23:31:00Z'), clockOut: null }),
    ).toBe('LATE')
  })

  it('예정 퇴근 전 퇴근 → EARLY_OUT', () => {
    expect(
      judgeAttendanceStatus({
        ...base,
        clockIn: at('2026-06-09T23:00:00Z'),
        clockOut: at('2026-06-10T08:00:00Z'), // 17:00 KST
      }),
    ).toBe('EARLY_OUT')
  })

  it('지각+조퇴 동시 → LATE 우선 (단일 enum)', () => {
    expect(
      judgeAttendanceStatus({
        ...base,
        clockIn: at('2026-06-10T00:00:00Z'), // 09:00 KST 지각
        clockOut: at('2026-06-10T08:00:00Z'), // 17:00 KST 조퇴
      }),
    ).toBe('LATE')
  })

  it('null 규칙: clockIn 없음 → 지각 판정 안 함 / clockOut 없음 → 조퇴 판정 안 함', () => {
    expect(judgeAttendanceStatus({ ...base, clockIn: null, clockOut: null })).toBe('NORMAL')
    expect(
      judgeAttendanceStatus({ ...base, clockIn: null, clockOut: at('2026-06-10T08:00:00Z') }),
    ).toBe('EARLY_OUT') // clockOut만 있어도 조퇴는 판정
    expect(
      judgeAttendanceStatus({ ...base, clockIn: at('2026-06-09T23:00:00Z'), clockOut: null }),
    ).toBe('NORMAL')
  })

  it('수동 ABSENT는 sticky — 시각 수정만으로 해제 안 됨', () => {
    expect(
      judgeAttendanceStatus({
        ...base,
        clockIn: at('2026-06-09T23:31:00Z'), // 지각 시각인데도
        clockOut: null,
        previousStatus: 'ABSENT',
      }),
    ).toBe('ABSENT')
  })

  it('previousStatus LATE는 sticky 아님 — 시각 기준 재판정 (정시로 정정되면 NORMAL)', () => {
    expect(
      judgeAttendanceStatus({
        ...base,
        clockIn: at('2026-06-09T23:00:00Z'),
        clockOut: at('2026-06-10T09:00:00Z'),
        previousStatus: 'LATE',
      }),
    ).toBe('NORMAL')
  })
})

describe('상수 계약', () => {
  it('기본 기준 출퇴근 = 08:30~17:30 (CEO 결정, S276)', () => {
    expect(DEFAULT_WORK_START).toBe('08:30')
    expect(DEFAULT_WORK_END).toBe('17:30')
  })

  it('퇴근 자동연결 한도 = 24h', () => {
    expect(CLOCK_OUT_ATTACH_LIMIT_MS).toBe(24 * 60 * 60 * 1000)
  })
})
