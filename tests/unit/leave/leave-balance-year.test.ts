import { describe, it, expect } from 'vitest'
import { getLeaveBalanceYear } from '@/lib/leave/leaveBalanceYear'

// 잔액 차감 연도 SSOT — 휴가는 "시작일의 연도" 단일 행에 차감/복구된다.
// (CEO 정책 2026-06-17: 연도 걸친 휴가는 시작 연도 전액)

describe('getLeaveBalanceYear', () => {
  it('returns the calendar year for a same-year start date', () => {
    expect(getLeaveBalanceYear(new Date(Date.UTC(2026, 5, 15)))).toBe(2026)
  })

  it('returns the START year for a year-spanning leave (Dec → Jan)', () => {
    // 휴가가 2025-12-28 ~ 2026-01-03 이어도 잔액은 시작일(2025) 연도에 차감
    const start = new Date(Date.UTC(2025, 11, 28))
    expect(getLeaveBalanceYear(start)).toBe(2025)
  })

  it('accepts an ISO date string', () => {
    expect(getLeaveBalanceYear('2027-03-01')).toBe(2027)
    expect(getLeaveBalanceYear('2025-12-31')).toBe(2025)
  })

  it('uses UTC — naive midnight date keeps its intended calendar year', () => {
    // 2026-01-01 자정(UTC 저장)은 2026년에 귀속 (off-by-one 없음)
    expect(getLeaveBalanceYear(new Date(Date.UTC(2026, 0, 1, 0, 0, 0)))).toBe(2026)
    expect(getLeaveBalanceYear('2026-01-01')).toBe(2026)
  })

  it('is stable across create/approve/reject/cancel for the same startDate', () => {
    // 동일 startDate면 모든 라이프사이클 단계가 같은 연도 행을 본다 (불변식)
    const startDate = new Date(Date.UTC(2025, 11, 31, 0, 0, 0))
    const atCreate = getLeaveBalanceYear(startDate)
    const atApprove = getLeaveBalanceYear(startDate)
    const atReject = getLeaveBalanceYear(startDate)
    const atCancel = getLeaveBalanceYear(startDate)
    expect(new Set([atCreate, atApprove, atReject, atCancel]).size).toBe(1)
    expect(atCreate).toBe(2025)
  })
})
