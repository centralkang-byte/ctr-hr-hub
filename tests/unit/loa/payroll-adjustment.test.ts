import { describe, it, expect } from 'vitest'
import {
  generateLoaMonthlyRanges,
  calculateLoaDeduction,
} from '@/lib/loa/payroll-adjustment'
import { getWeekdaysInMonth } from '@/lib/payroll/kr-tax'

// ─── Helpers ───────────────────────────────────────────────

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

// ─── generateLoaMonthlyRanges ──────────────────────────────

describe('generateLoaMonthlyRanges', () => {
  it('should return 1 range for single-day LOA (weekday)', () => {
    // March 16, 2026 = Monday
    const ranges = generateLoaMonthlyRanges(utc(2026, 3, 16), utc(2026, 3, 16))
    expect(ranges).toHaveLength(1)
    expect(ranges[0].yearMonth).toBe('2026-03')
    expect(ranges[0].loaDaysInMonth).toBe(1)
  })

  it('should return 1 range for partial month', () => {
    const ranges = generateLoaMonthlyRanges(utc(2026, 3, 10), utc(2026, 3, 20))
    expect(ranges).toHaveLength(1)
    expect(ranges[0].yearMonth).toBe('2026-03')
    expect(ranges[0].loaDaysInMonth).toBeGreaterThan(0)
  })

  it('should return totalWorkdaysInMonth matching getWeekdaysInMonth for full month', () => {
    const ranges = generateLoaMonthlyRanges(utc(2026, 3, 1), utc(2026, 3, 31))
    expect(ranges).toHaveLength(1)
    expect(ranges[0].totalWorkdaysInMonth).toBe(getWeekdaysInMonth(2026, 3))
  })

  it('should split into 2 ranges for cross-month LOA', () => {
    const ranges = generateLoaMonthlyRanges(utc(2026, 3, 20), utc(2026, 4, 10))
    expect(ranges).toHaveLength(2)
    expect(ranges[0].yearMonth).toBe('2026-03')
    expect(ranges[1].yearMonth).toBe('2026-04')
  })

  it('should split into 3 ranges for 3-month span', () => {
    const ranges = generateLoaMonthlyRanges(utc(2026, 1, 15), utc(2026, 3, 10))
    expect(ranges).toHaveLength(3)
  })

  it('should handle exact month boundaries (1st to last day)', () => {
    const ranges = generateLoaMonthlyRanges(utc(2026, 3, 1), utc(2026, 4, 30))
    expect(ranges).toHaveLength(2)
    expect(ranges[0].yearMonth).toBe('2026-03')
    expect(ranges[1].yearMonth).toBe('2026-04')
  })

  it('should handle cross-year boundary', () => {
    const ranges = generateLoaMonthlyRanges(utc(2025, 12, 15), utc(2026, 1, 15))
    expect(ranges).toHaveLength(2)
    expect(ranges[0].yearMonth).toBe('2025-12')
    expect(ranges[1].yearMonth).toBe('2026-01')
  })

  it('should handle February non-leap year', () => {
    const ranges = generateLoaMonthlyRanges(utc(2026, 2, 1), utc(2026, 2, 28))
    expect(ranges).toHaveLength(1)
    expect(ranges[0].totalWorkdaysInMonth).toBe(getWeekdaysInMonth(2026, 2))
  })

  it('should handle February leap year (2028)', () => {
    const ranges = generateLoaMonthlyRanges(utc(2028, 2, 1), utc(2028, 2, 29))
    expect(ranges).toHaveLength(1)
    expect(ranges[0].totalWorkdaysInMonth).toBe(getWeekdaysInMonth(2028, 2))
  })

  it('should respect actual start date in loaStartInMonth', () => {
    const ranges = generateLoaMonthlyRanges(utc(2026, 3, 15), utc(2026, 4, 10))
    expect(ranges[0].loaStartInMonth).toEqual(utc(2026, 3, 15))
  })

  it('should respect actual end date in loaEndInMonth', () => {
    const ranges = generateLoaMonthlyRanges(utc(2026, 3, 1), utc(2026, 4, 10))
    expect(ranges[1].loaEndInMonth).toEqual(utc(2026, 4, 10))
  })

  it('should return 6 ranges for 6-month LOA', () => {
    const ranges = generateLoaMonthlyRanges(utc(2026, 1, 1), utc(2026, 6, 30))
    expect(ranges).toHaveLength(6)
    expect(ranges.map(r => r.yearMonth)).toEqual([
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
    ])
  })
})

// ─── calculateLoaDeduction ─────────────────────────────────

describe('calculateLoaDeduction', () => {
  it('should return 0 for PAID type', () => {
    expect(calculateLoaDeduction(3_000_000, 10, 22, 'PAID', null)).toBe(0)
  })

  it('should deduct full salary for UNPAID full month', () => {
    expect(calculateLoaDeduction(3_000_000, 22, 22, 'UNPAID', null)).toBe(-3_000_000)
  })

  it('should deduct proportional for UNPAID partial month', () => {
    expect(calculateLoaDeduction(3_000_000, 11, 22, 'UNPAID', null)).toBe(-1_500_000)
  })

  it('should deduct full for INSURANCE type (company-side deduction)', () => {
    expect(calculateLoaDeduction(3_000_000, 22, 22, 'INSURANCE', null)).toBe(-3_000_000)
  })

  it('should deduct proportional for INSURANCE partial month', () => {
    const expected = -Math.round(3_000_000 * 5 / 22)
    expect(calculateLoaDeduction(3_000_000, 5, 22, 'INSURANCE', null)).toBe(expected)
  })

  it('should apply payRate for PARTIAL type (60% pay → 40% deduction)', () => {
    const expected = -Math.round(3_000_000 * 1.0 * (1 - 60 / 100))
    expect(calculateLoaDeduction(3_000_000, 22, 22, 'PARTIAL', 60)).toBe(expected)
  })

  it('should return 0 for PARTIAL with 100% payRate (full pay)', () => {
    // -Math.round(3M * 1.0 * (1 - 100/100)) = -Math.round(0) = -0
    expect(Math.abs(calculateLoaDeduction(3_000_000, 22, 22, 'PARTIAL', 100))).toBe(0)
  })

  it('should deduct full for PARTIAL with 0% payRate (like UNPAID)', () => {
    expect(calculateLoaDeduction(3_000_000, 22, 22, 'PARTIAL', 0)).toBe(-3_000_000)
  })

  it('should apply payRate for MIXED type', () => {
    const expected = -Math.round(3_000_000 * (11 / 22) * (1 - 50 / 100))
    expect(calculateLoaDeduction(3_000_000, 11, 22, 'MIXED', 50)).toBe(expected)
  })

  it('should default to 100% payRate when null for PARTIAL (0 deduction)', () => {
    // payRate defaults to 100 → (1 - 100/100) = 0 → -0
    expect(Math.abs(calculateLoaDeduction(3_000_000, 22, 22, 'PARTIAL', null))).toBe(0)
  })

  it('should return 0 when totalWorkdays is 0 (division guard)', () => {
    expect(calculateLoaDeduction(3_000_000, 5, 0, 'UNPAID', null)).toBe(0)
  })

  it('should handle loaDays > totalWorkdays (over-ratio — documents edge case, impossible via generateLoaMonthlyRanges)', () => {
    // generateLoaMonthlyRanges guarantees loaDays ≤ totalWorkdays,
    // but the function itself does not cap — this documents current behavior
    const expected = -Math.round(3_000_000 * 25 / 22)
    expect(calculateLoaDeduction(3_000_000, 25, 22, 'UNPAID', null)).toBe(expected)
  })

  it('should return 0 for unknown payType', () => {
    expect(calculateLoaDeduction(3_000_000, 22, 22, 'UNKNOWN', null)).toBe(0)
  })

  it('should return 0 for zero salary', () => {
    expect(calculateLoaDeduction(0, 22, 22, 'UNPAID', null)).toBe(-0)
  })

  it('should always return non-positive value', () => {
    const cases = [
      calculateLoaDeduction(3_000_000, 22, 22, 'UNPAID', null),
      calculateLoaDeduction(3_000_000, 11, 22, 'PARTIAL', 60),
      calculateLoaDeduction(3_000_000, 5, 22, 'INSURANCE', null),
    ]
    cases.forEach(result => expect(result).toBeLessThanOrEqual(0))
  })
})
