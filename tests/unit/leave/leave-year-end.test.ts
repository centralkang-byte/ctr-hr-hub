import { describe, it, expect } from 'vitest'
import {
  resolveLeaveYearEnd,
  leaveYearEndYear,
  subMonthsUtc,
} from '@/lib/leave/leave-year-end'

// ─── Helpers ────────────────────────────────────────────────

/** Create UTC date to avoid CI timezone issues */
function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// ─── resolveLeaveYearEnd: calendar_year ─────────────────────

describe('resolveLeaveYearEnd — calendar_year', () => {
  it('returns Dec 31 of current year regardless of now', () => {
    expect(iso(resolveLeaveYearEnd('calendar_year', utc(2010, 3, 4), utc(2026, 1, 5)))).toBe('2026-12-31')
    expect(iso(resolveLeaveYearEnd('calendar_year', utc(2010, 3, 4), utc(2026, 7, 1)))).toBe('2026-12-31')
    expect(iso(resolveLeaveYearEnd('calendar_year', utc(2010, 3, 4), utc(2026, 12, 31)))).toBe('2026-12-31')
  })

  it('unknown/undefined basis falls back to calendar_year (Dec 31)', () => {
    expect(iso(resolveLeaveYearEnd('something_else', utc(2010, 3, 4), utc(2026, 6, 1)))).toBe('2026-12-31')
  })
})

// ─── resolveLeaveYearEnd: hire_date_anniversary ─────────────

describe('resolveLeaveYearEnd — hire_date_anniversary', () => {
  it('returns this year anniversary when it is still upcoming', () => {
    // hire 2020-07-01, now 2026-01-05 → next anniversary 2026-07-01
    expect(iso(resolveLeaveYearEnd('hire_date_anniversary', utc(2020, 7, 1), utc(2026, 1, 5)))).toBe('2026-07-01')
  })

  it('rolls to next year when anniversary already passed', () => {
    // hire 2020-07-01, now 2026-08-01 → 2027-07-01
    expect(iso(resolveLeaveYearEnd('hire_date_anniversary', utc(2020, 7, 1), utc(2026, 8, 1)))).toBe('2027-07-01')
  })

  it('treats the anniversary day itself as the (current) period end (>= now)', () => {
    expect(iso(resolveLeaveYearEnd('hire_date_anniversary', utc(2020, 7, 1), utc(2026, 7, 1)))).toBe('2026-07-01')
  })

  it('clamps Feb 29 hire to Feb 28 in a non-leap target year', () => {
    // hire 2016-02-29, now 2026-01-10 → 2026 not leap → 2026-02-28
    expect(iso(resolveLeaveYearEnd('hire_date_anniversary', utc(2016, 2, 29), utc(2026, 1, 10)))).toBe('2026-02-28')
  })

  it('keeps Feb 29 in a leap target year', () => {
    // hire 2016-02-29, now 2028-01-10 → 2028 leap → 2028-02-29
    expect(iso(resolveLeaveYearEnd('hire_date_anniversary', utc(2016, 2, 29), utc(2028, 1, 10)))).toBe('2028-02-29')
  })
})

// ─── leaveYearEndYear ───────────────────────────────────────

describe('leaveYearEndYear', () => {
  it('returns the period-end calendar year (not the notice send year)', () => {
    // anniversary basis: stage1 (~6mo before 2027-07-01) fires in Dec 2026,
    // but the log year must be 2027 (period end year)
    const periodEnd = resolveLeaveYearEnd('hire_date_anniversary', utc(2020, 7, 1), utc(2026, 12, 30))
    expect(iso(periodEnd)).toBe('2027-07-01')
    expect(leaveYearEndYear(periodEnd)).toBe(2027)
  })
})

// ─── subMonthsUtc ───────────────────────────────────────────

describe('subMonthsUtc', () => {
  it('subtracts calendar months (Dec 31 − 6mo = Jun 30)', () => {
    expect(iso(subMonthsUtc(utc(2026, 12, 31), 6))).toBe('2026-06-30')
  })

  it('Dec 31 − 2mo = Oct 31', () => {
    expect(iso(subMonthsUtc(utc(2026, 12, 31), 2))).toBe('2026-10-31')
  })

  it('crosses year boundary (2026-03-31 − 6mo = 2025-09-30)', () => {
    expect(iso(subMonthsUtc(utc(2026, 3, 31), 6))).toBe('2025-09-30')
  })

  it('clamps to end of shorter target month (Aug 31 − 6mo = Feb 28 / non-leap)', () => {
    expect(iso(subMonthsUtc(utc(2027, 8, 31), 6))).toBe('2027-02-28')
  })

  it('clamps to Feb 29 in a leap year (Aug 31 2028 − 6mo = Feb 29 2028)', () => {
    expect(iso(subMonthsUtc(utc(2028, 8, 31), 6))).toBe('2028-02-29')
  })

  it('anniversary period end Jul 1 − 6mo = Jan 1; − 2mo = May 1', () => {
    expect(iso(subMonthsUtc(utc(2027, 7, 1), 6))).toBe('2027-01-01')
    expect(iso(subMonthsUtc(utc(2027, 7, 1), 2))).toBe('2027-05-01')
  })
})
