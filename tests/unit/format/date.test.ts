import { describe, it, expect } from 'vitest'
import {
  formatDate,
  formatDateTime,
  formatDateLong,
  formatDateShort,
  formatMonth,
  formatDateISO,
  formatDateLocale,
  formatDateWithDay,
  formatDateCompactWithDay,
} from '@/lib/format/date'

// ─── formatDate ────────────────────────────────────────────

describe('formatDate', () => {
  it('should return - for null', () => {
    expect(formatDate(null)).toBe('-')
  })

  it('should format Date object with zero-padded month/day', () => {
    expect(formatDate(new Date(2026, 2, 5))).toBe('2026.03.05')
  })

  it('should parse ISO string input', () => {
    // new Date('2026-06-15') is parsed as local midnight — safe for getFullYear/getMonth/getDate
    const result = formatDate('2026-06-15T12:00:00')
    expect(result).toBe('2026.06.15')
  })
})

// ─── formatDateTime ────────────────────────────────────────

describe('formatDateTime', () => {
  it('should return - for undefined', () => {
    expect(formatDateTime(undefined)).toBe('-')
  })

  it('should format date with time from Date object', () => {
    const d = new Date(2026, 2, 12, 14, 30)
    expect(formatDateTime(d)).toBe('2026.03.12 14:30')
  })

  it('should parse ISO string with time', () => {
    const result = formatDateTime('2026-03-12T14:30:00')
    expect(result).toContain('2026.03.12')
    expect(result).toContain('14:30')
  })

  it('should return - for invalid date string', () => {
    expect(formatDateTime('invalid-date')).toBe('-')
  })
})

// ─── formatDateLong ────────────────────────────────────────

describe('formatDateLong', () => {
  it('should return - for null', () => {
    expect(formatDateLong(null)).toBe('-')
  })

  it('should format without zero-padding month/day', () => {
    expect(formatDateLong(new Date(2026, 2, 5))).toBe('2026년 3월 5일')
  })

  it('should handle December correctly', () => {
    expect(formatDateLong(new Date(2026, 11, 25))).toBe('2026년 12월 25일')
  })
})

// ─── formatDateShort ───────────────────────────────────────

describe('formatDateShort', () => {
  it('should return - for null', () => {
    expect(formatDateShort(null)).toBe('-')
  })

  it('should format month and day only', () => {
    expect(formatDateShort(new Date(2026, 2, 12))).toBe('3월 12일')
  })
})

// ─── formatMonth ───────────────────────────────────────────

describe('formatMonth', () => {
  it('should return - for null', () => {
    expect(formatMonth(null)).toBe('-')
  })

  it('should format year-month with zero-padded month', () => {
    expect(formatMonth(new Date(2026, 2, 12))).toBe('2026-03')
  })

  it('should zero-pad January', () => {
    expect(formatMonth(new Date(2026, 0, 15))).toBe('2026-01')
  })
})

// ─── formatDateISO ─────────────────────────────────────────

describe('formatDateISO', () => {
  it('should return - for null', () => {
    expect(formatDateISO(null)).toBe('-')
  })

  it('should format with zero-padded day', () => {
    expect(formatDateISO(new Date(2026, 2, 5))).toBe('2026-03-05')
  })

  it('should parse string input', () => {
    expect(formatDateISO('2026-06-15T12:00:00')).toBe('2026-06-15')
  })
})

// ─── formatDateLocale ──────────────────────────────────────

describe('formatDateLocale', () => {
  it('should return - for null', () => {
    expect(formatDateLocale(null)).toBe('-')
  })

  it('should contain the year (CI locale-safe)', () => {
    const result = formatDateLocale(new Date(2026, 2, 12))
    expect(result).toContain('2026')
  })
})

// ─── formatDateWithDay ─────────────────────────────────────

describe('formatDateWithDay', () => {
  it('should return - for null', () => {
    expect(formatDateWithDay(null)).toBe('-')
  })

  // 2026-03-11 = Wednesday (수)
  it('should include Korean day-of-week', () => {
    expect(formatDateWithDay(new Date(2026, 2, 11))).toBe('3월 11일 (수)')
  })

  // 2026-03-15 = Sunday (일)
  it('should handle Sunday', () => {
    expect(formatDateWithDay(new Date(2026, 2, 15))).toBe('3월 15일 (일)')
  })
})

// ─── formatDateCompactWithDay ──────────────────────────────

describe('formatDateCompactWithDay', () => {
  it('should return - for null', () => {
    expect(formatDateCompactWithDay(null)).toBe('-')
  })

  // 2026-03-11 = Wednesday (수)
  it('should format compact with day-of-week', () => {
    expect(formatDateCompactWithDay(new Date(2026, 2, 11))).toBe('3/11 (수)')
  })

  // 2026-03-15 = Sunday (일)
  it('should handle Sunday compact', () => {
    expect(formatDateCompactWithDay(new Date(2026, 2, 15))).toBe('3/15 (일)')
  })
})
