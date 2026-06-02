import { describe, it, expect } from 'vitest'
import { isBalanceTracked, resolveEventLeaveDayCap } from '@/lib/leave/eventBasedLeave'

// ─── isBalanceTracked: accrual rule 존재 ⇔ 잔액 추적(적립형) ───

describe('isBalanceTracked', () => {
  it('returns false when no active accrual rule exists (event-based leave)', () => {
    expect(isBalanceTracked(0)).toBe(false)
  })

  it('returns true when one or more accrual rules exist (balance-tracked)', () => {
    expect(isBalanceTracked(1)).toBe(true)
    expect(isBalanceTracked(3)).toBe(true)
  })
})

// ─── resolveEventLeaveDayCap: maxConsecutiveDays ?? policy.defaultDays ───

describe('resolveEventLeaveDayCap', () => {
  it('prefers maxConsecutiveDays when set (e.g. bereavement 5d)', () => {
    expect(resolveEventLeaveDayCap({ maxConsecutiveDays: 5, policyDefaultDays: 3 })).toBe(5)
  })

  it('falls back to policy.defaultDays when maxConsecutiveDays is null (e.g. 특별휴가 3d)', () => {
    expect(resolveEventLeaveDayCap({ maxConsecutiveDays: null, policyDefaultDays: 3 })).toBe(3)
  })

  it('returns null when neither cap is defined (no upper bound)', () => {
    expect(resolveEventLeaveDayCap({ maxConsecutiveDays: null, policyDefaultDays: null })).toBeNull()
    expect(resolveEventLeaveDayCap({})).toBeNull()
  })

  it('ignores non-positive values', () => {
    expect(resolveEventLeaveDayCap({ maxConsecutiveDays: 0, policyDefaultDays: 3 })).toBe(3)
    expect(resolveEventLeaveDayCap({ maxConsecutiveDays: 0, policyDefaultDays: 0 })).toBeNull()
  })
})
