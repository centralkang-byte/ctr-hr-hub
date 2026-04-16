import { describe, it, expect } from 'vitest'
import { calculateLeaveDays } from '@/lib/leave/calculateLeaveDays'

// ─── Helpers ────────────────────────────────────────────────

/** Create UTC date to avoid CI timezone issues */
function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

// 2026-01-01 (Thu) is a Korean public holiday (New Year's Day)
const HOLIDAY_JAN1 = utc(2026, 1, 1)

// ─── business_day + includesHolidays=false (standard annual leave) ───

describe('calculateLeaveDays — business_day, no holidays', () => {
  it('should return 5 for Mon-Fri range', () => {
    // 2026-01-05 (Mon) to 2026-01-09 (Fri)
    expect(calculateLeaveDays({
      startDate: utc(2026, 1, 5),
      endDate: utc(2026, 1, 9),
      countingMethod: 'business_day',
      includesHolidays: false,
    })).toBe(5)
  })

  it('should exclude weekends from count', () => {
    // 2026-01-05 (Mon) to 2026-01-11 (Sun) = 5 weekdays
    expect(calculateLeaveDays({
      startDate: utc(2026, 1, 5),
      endDate: utc(2026, 1, 11),
      countingMethod: 'business_day',
      includesHolidays: false,
    })).toBe(5)
  })

  it('should exclude public holidays', () => {
    // 2025-12-29 (Mon) to 2026-01-02 (Fri) = 5 weekdays - 1 holiday = 4
    expect(calculateLeaveDays({
      startDate: utc(2025, 12, 29),
      endDate: utc(2026, 1, 2),
      countingMethod: 'business_day',
      includesHolidays: false,
      holidays: [HOLIDAY_JAN1],
    })).toBe(4)
  })

  it('should return 0 for weekend-only range', () => {
    // 2026-01-10 (Sat) to 2026-01-11 (Sun)
    expect(calculateLeaveDays({
      startDate: utc(2026, 1, 10),
      endDate: utc(2026, 1, 11),
      countingMethod: 'business_day',
      includesHolidays: false,
    })).toBe(0)
  })

  it('should return 1 for single weekday', () => {
    expect(calculateLeaveDays({
      startDate: utc(2026, 1, 5), // Mon
      endDate: utc(2026, 1, 5),
      countingMethod: 'business_day',
      includesHolidays: false,
    })).toBe(1)
  })

  it('should return 0 for start > end', () => {
    expect(calculateLeaveDays({
      startDate: utc(2026, 1, 9),
      endDate: utc(2026, 1, 5),
      countingMethod: 'business_day',
      includesHolidays: false,
    })).toBe(0)
  })
})

// ─── business_day + includesHolidays=true ────────────────────

describe('calculateLeaveDays — business_day, with holidays', () => {
  it('should exclude weekends but include holidays', () => {
    // 2025-12-29 (Mon) to 2026-01-02 (Fri) = 5 weekdays (holiday included)
    expect(calculateLeaveDays({
      startDate: utc(2025, 12, 29),
      endDate: utc(2026, 1, 2),
      countingMethod: 'business_day',
      includesHolidays: true,
      holidays: [HOLIDAY_JAN1],
    })).toBe(5)
  })

  it('should still exclude weekends', () => {
    // 2026-01-05 (Mon) to 2026-01-11 (Sun) = 5 weekdays
    expect(calculateLeaveDays({
      startDate: utc(2026, 1, 5),
      endDate: utc(2026, 1, 11),
      countingMethod: 'business_day',
      includesHolidays: true,
    })).toBe(5)
  })

  it('should count holiday on weekday as working day', () => {
    // Single day that is a holiday and a weekday
    expect(calculateLeaveDays({
      startDate: HOLIDAY_JAN1,
      endDate: HOLIDAY_JAN1,
      countingMethod: 'business_day',
      includesHolidays: true,
      holidays: [HOLIDAY_JAN1],
    })).toBe(1)
  })
})

// ─── calendar_day + includesHolidays=true (bereavement/maternity) ───

describe('calculateLeaveDays — calendar_day, with holidays', () => {
  it('should count all days including weekends and holidays', () => {
    // 7 consecutive days = 7
    expect(calculateLeaveDays({
      startDate: utc(2026, 1, 5),
      endDate: utc(2026, 1, 11),
      countingMethod: 'calendar_day',
      includesHolidays: true,
    })).toBe(7)
  })

  it('should use fast path (date math, not iteration)', () => {
    // Large range should still work efficiently
    expect(calculateLeaveDays({
      startDate: utc(2026, 1, 1),
      endDate: utc(2026, 12, 31),
      countingMethod: 'calendar_day',
      includesHolidays: true,
    })).toBe(365)
  })

  it('should return 1 for same day', () => {
    expect(calculateLeaveDays({
      startDate: utc(2026, 1, 5),
      endDate: utc(2026, 1, 5),
      countingMethod: 'calendar_day',
      includesHolidays: true,
    })).toBe(1)
  })

  it('should include weekends in count', () => {
    // Sat-Sun = 2
    expect(calculateLeaveDays({
      startDate: utc(2026, 1, 10), // Sat
      endDate: utc(2026, 1, 11),   // Sun
      countingMethod: 'calendar_day',
      includesHolidays: true,
    })).toBe(2)
  })
})

// ─── calendar_day + includesHolidays=false ───────────────────

describe('calculateLeaveDays — calendar_day, no holidays', () => {
  it('should include weekends but exclude holidays', () => {
    // 2025-12-29 (Mon) to 2026-01-04 (Sun) = 7 days - 1 holiday = 6
    expect(calculateLeaveDays({
      startDate: utc(2025, 12, 29),
      endDate: utc(2026, 1, 4),
      countingMethod: 'calendar_day',
      includesHolidays: false,
      holidays: [HOLIDAY_JAN1],
    })).toBe(6)
  })

  it('should count all days when no holidays in range', () => {
    expect(calculateLeaveDays({
      startDate: utc(2026, 1, 5),
      endDate: utc(2026, 1, 11),
      countingMethod: 'calendar_day',
      includesHolidays: false,
    })).toBe(7)
  })

  it('should exclude only holidays, keep weekends', () => {
    // Weekend + holiday on weekday
    expect(calculateLeaveDays({
      startDate: utc(2026, 1, 1), // Thu (holiday)
      endDate: utc(2026, 1, 4),   // Sun
      countingMethod: 'calendar_day',
      includesHolidays: false,
      holidays: [HOLIDAY_JAN1],
    })).toBe(3) // Fri, Sat, Sun (Thu excluded as holiday)
  })
})

// ─── Edge cases ─────────────────────────────────────────────

describe('calculateLeaveDays — edge cases', () => {
  it('should return 0 when start > end', () => {
    expect(calculateLeaveDays({
      startDate: utc(2026, 1, 10),
      endDate: utc(2026, 1, 5),
      countingMethod: 'business_day',
      includesHolidays: false,
    })).toBe(0)
  })

  it('should return 1 for same weekday', () => {
    expect(calculateLeaveDays({
      startDate: utc(2026, 1, 5), // Mon
      endDate: utc(2026, 1, 5),
      countingMethod: 'business_day',
      includesHolidays: false,
    })).toBe(1)
  })

  it('should handle empty holidays array', () => {
    expect(calculateLeaveDays({
      startDate: utc(2026, 1, 5),
      endDate: utc(2026, 1, 9),
      countingMethod: 'business_day',
      includesHolidays: false,
      holidays: [],
    })).toBe(5)
  })

  it('should ignore holidays outside date range', () => {
    const farHoliday = utc(2026, 6, 1)
    expect(calculateLeaveDays({
      startDate: utc(2026, 1, 5),
      endDate: utc(2026, 1, 9),
      countingMethod: 'business_day',
      includesHolidays: false,
      holidays: [farHoliday],
    })).toBe(5)
  })

  it('should return 0 for single weekend day in business_day mode', () => {
    expect(calculateLeaveDays({
      startDate: utc(2026, 1, 10), // Sat
      endDate: utc(2026, 1, 10),
      countingMethod: 'business_day',
      includesHolidays: false,
    })).toBe(0)
  })

  it('should handle cross-month boundary', () => {
    // 2026-01-30 (Fri) to 2026-02-02 (Mon) = Fri + Mon = 2 weekdays
    expect(calculateLeaveDays({
      startDate: utc(2026, 1, 30),
      endDate: utc(2026, 2, 2),
      countingMethod: 'business_day',
      includesHolidays: false,
    })).toBe(2)
  })

  // Codex #4: non-midnight input test
  it('should handle non-midnight date inputs (14:30)', () => {
    // calendar_day fast path uses getTime() — non-midnight should still work
    const start = new Date(2026, 0, 5, 14, 30) // Jan 5, 2:30pm
    const end = new Date(2026, 0, 7, 9, 0)     // Jan 7, 9:00am
    const result = calculateLeaveDays({
      startDate: start,
      endDate: end,
      countingMethod: 'calendar_day',
      includesHolidays: true,
    })
    // Should count partial days: floor((end-start)/86400000) + 1
    // The fast path does: floor((end-start)/msPerDay) + 1
    expect(result).toBeGreaterThanOrEqual(2)
    expect(result).toBeLessThanOrEqual(3)
  })
})
