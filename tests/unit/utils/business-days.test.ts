import { describe, it, expect } from 'vitest'
import { calculateBusinessDays } from '@/lib/utils/business-days'

// ─── Helpers ────────────────────────────────────────────────

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

// ─── Tests ──────────────────────────────────────────────────

describe('calculateBusinessDays', () => {
  it('should return 5 for Mon-Fri range', () => {
    // 2026-01-05 (Mon) to 2026-01-09 (Fri)
    expect(calculateBusinessDays(utc(2026, 1, 5), utc(2026, 1, 9))).toBe(5)
  })

  it('should exclude weekends from count', () => {
    // 2026-01-05 (Mon) to 2026-01-11 (Sun) = 5 weekdays
    expect(calculateBusinessDays(utc(2026, 1, 5), utc(2026, 1, 11))).toBe(5)
  })

  it('should exclude holidays from count', () => {
    // 2026-01-05 (Mon) to 2026-01-09 (Fri) with Wed as holiday = 4
    const holiday = utc(2026, 1, 7) // Wednesday
    expect(calculateBusinessDays(utc(2026, 1, 5), utc(2026, 1, 9), [holiday])).toBe(4)
  })

  it('should return 0 for start > end', () => {
    expect(calculateBusinessDays(utc(2026, 1, 9), utc(2026, 1, 5))).toBe(0)
  })

  it('should return 1 for single weekday', () => {
    expect(calculateBusinessDays(utc(2026, 1, 5), utc(2026, 1, 5))).toBe(1) // Mon
  })

  it('should return 0 for single weekend day', () => {
    expect(calculateBusinessDays(utc(2026, 1, 10), utc(2026, 1, 10))).toBe(0) // Sat
  })

  it('should handle empty holidays array', () => {
    expect(calculateBusinessDays(utc(2026, 1, 5), utc(2026, 1, 9), [])).toBe(5)
  })

  it('should handle cross-month boundary', () => {
    // 2026-01-30 (Fri) to 2026-02-02 (Mon) = Fri + Mon = 2
    expect(calculateBusinessDays(utc(2026, 1, 30), utc(2026, 2, 2))).toBe(2)
  })
})
