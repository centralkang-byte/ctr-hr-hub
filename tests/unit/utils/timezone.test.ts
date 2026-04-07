import { describe, it, expect } from 'vitest'
import { formatToTz, getStartOfDayTz, getEndOfDayTz, parseDateOnly } from '@/lib/timezone'

// ─── formatToTz ─────────────────────────────────────────────

describe('formatToTz', () => {
  it('should return empty string for null date', () => {
    expect(formatToTz(null, 'Asia/Seoul', 'yyyy-MM-dd')).toBe('')
  })

  it('should format Date object in Asia/Seoul timezone (+9)', () => {
    // 2026-01-15 00:00 UTC → 2026-01-15 09:00 KST
    const utcDate = new Date(Date.UTC(2026, 0, 15, 0, 0, 0))
    expect(formatToTz(utcDate, 'Asia/Seoul', 'yyyy-MM-dd HH:mm')).toBe('2026-01-15 09:00')
  })

  it('should format ISO string input in Asia/Seoul timezone', () => {
    expect(formatToTz('2026-01-15T00:00:00.000Z', 'Asia/Seoul', 'yyyy-MM-dd HH:mm')).toBe('2026-01-15 09:00')
  })

  it('should format date in America/Chicago timezone (CST -6 in January)', () => {
    // 2026-01-15 06:00 UTC → 2026-01-15 00:00 CST
    const utcDate = new Date(Date.UTC(2026, 0, 15, 6, 0, 0))
    expect(formatToTz(utcDate, 'America/Chicago', 'yyyy-MM-dd HH:mm')).toBe('2026-01-15 00:00')
  })

  it('should format date in Europe/Moscow timezone (+3)', () => {
    // 2026-01-15 00:00 UTC → 2026-01-15 03:00 MSK
    const utcDate = new Date(Date.UTC(2026, 0, 15, 0, 0, 0))
    expect(formatToTz(utcDate, 'Europe/Moscow', 'yyyy-MM-dd HH:mm')).toBe('2026-01-15 03:00')
  })

  it('should format date in UTC timezone', () => {
    const utcDate = new Date(Date.UTC(2026, 0, 15, 12, 30, 0))
    expect(formatToTz(utcDate, 'UTC', 'yyyy-MM-dd HH:mm')).toBe('2026-01-15 12:30')
  })

  it('should respect format string parameter', () => {
    const utcDate = new Date(Date.UTC(2026, 0, 15, 9, 30, 45))
    expect(formatToTz(utcDate, 'UTC', 'HH:mm:ss')).toBe('09:30:45')
    expect(formatToTz(utcDate, 'UTC', 'yyyy-MM-dd')).toBe('2026-01-15')
  })

  // Codex Gate 1: DST transition — America/Chicago CDT (-5 in July)
  it('should handle DST offset for America/Chicago in summer', () => {
    // 2026-07-15 05:00 UTC → 2026-07-15 00:00 CDT
    const utcDate = new Date(Date.UTC(2026, 6, 15, 5, 0, 0))
    expect(formatToTz(utcDate, 'America/Chicago', 'yyyy-MM-dd HH:mm')).toBe('2026-07-15 00:00')
  })
})

// ─── getStartOfDayTz ───────────────────────────────────────

describe('getStartOfDayTz', () => {
  it('should return UTC equivalent of midnight in Asia/Seoul', () => {
    // Seoul 2026-01-15 00:00:00 = UTC 2026-01-14 15:00:00
    const utcDate = new Date(Date.UTC(2026, 0, 15, 3, 0, 0)) // any time on that UTC day
    const result = getStartOfDayTz(utcDate, 'Asia/Seoul')
    // The result should be UTC 15:00 on Jan 14 (Seoul midnight Jan 15)
    expect(result.getUTCHours()).toBe(15)
    expect(result.getUTCDate()).toBe(14)
    expect(result.getUTCMinutes()).toBe(0)
    expect(result.getUTCSeconds()).toBe(0)
    expect(result.getUTCMilliseconds()).toBe(0)
  })

  it('should return UTC equivalent of midnight in America/Chicago (January CST)', () => {
    // Chicago 2026-01-15 00:00:00 CST = UTC 2026-01-15 06:00:00
    const utcDate = new Date(Date.UTC(2026, 0, 15, 12, 0, 0))
    const result = getStartOfDayTz(utcDate, 'America/Chicago')
    expect(result.getUTCHours()).toBe(6)
    expect(result.getUTCDate()).toBe(15)
  })

  it('should return UTC equivalent of midnight in Europe/Moscow', () => {
    // Moscow 2026-01-15 00:00:00 = UTC 2026-01-14 21:00:00
    const utcDate = new Date(Date.UTC(2026, 0, 15, 0, 0, 0))
    const result = getStartOfDayTz(utcDate, 'Europe/Moscow')
    expect(result.getUTCHours()).toBe(21)
    expect(result.getUTCDate()).toBe(14)
  })

  it('should accept ISO string input', () => {
    const result = getStartOfDayTz('2026-01-15T12:00:00.000Z', 'Asia/Seoul')
    // Seoul date for UTC 12:00 is Jan 15 (21:00 KST) → start of Jan 15 KST = Jan 14 15:00 UTC
    expect(result.getUTCHours()).toBe(15)
  })

  it('should return exactly 00:00:00.000 when formatted back to target timezone', () => {
    const result = getStartOfDayTz(new Date(Date.UTC(2026, 0, 15, 10, 0, 0)), 'Asia/Seoul')
    expect(formatToTz(result, 'Asia/Seoul', 'HH:mm:ss.SSS')).toBe('00:00:00.000')
  })

  // Codex Gate 1: DST transition date
  it('should handle DST spring-forward for America/Chicago', () => {
    // 2026 DST starts March 8 in US
    const result = getStartOfDayTz('2026-03-08T12:00:00.000Z', 'America/Chicago')
    expect(formatToTz(result, 'America/Chicago', 'HH:mm:ss')).toBe('00:00:00')
  })
})

// ─── getEndOfDayTz ──────────────────────────────────────────

describe('getEndOfDayTz', () => {
  it('should return UTC equivalent of 23:59:59.999 in Asia/Seoul', () => {
    const utcDate = new Date(Date.UTC(2026, 0, 15, 3, 0, 0))
    const result = getEndOfDayTz(utcDate, 'Asia/Seoul')
    expect(formatToTz(result, 'Asia/Seoul', 'HH:mm:ss.SSS')).toBe('23:59:59.999')
  })

  it('should return UTC equivalent of 23:59:59.999 in America/Chicago', () => {
    const utcDate = new Date(Date.UTC(2026, 0, 15, 12, 0, 0))
    const result = getEndOfDayTz(utcDate, 'America/Chicago')
    expect(formatToTz(result, 'America/Chicago', 'HH:mm:ss.SSS')).toBe('23:59:59.999')
  })

  it('should accept ISO string input', () => {
    const result = getEndOfDayTz('2026-01-15T00:00:00.000Z', 'UTC')
    expect(result.getUTCHours()).toBe(23)
    expect(result.getUTCMinutes()).toBe(59)
    expect(result.getUTCSeconds()).toBe(59)
    expect(result.getUTCMilliseconds()).toBe(999)
  })

  it('should produce end > start for same date and timezone', () => {
    const date = new Date(Date.UTC(2026, 0, 15, 10, 0, 0))
    const start = getStartOfDayTz(date, 'Asia/Seoul')
    const end = getEndOfDayTz(date, 'Asia/Seoul')
    expect(end.getTime()).toBeGreaterThan(start.getTime())
  })

  it('should span ~24h between start and end of same day', () => {
    const date = new Date(Date.UTC(2026, 0, 15, 10, 0, 0))
    const start = getStartOfDayTz(date, 'Asia/Seoul')
    const end = getEndOfDayTz(date, 'Asia/Seoul')
    const diffMs = end.getTime() - start.getTime()
    // 23h 59m 59s 999ms = 86_399_999ms
    expect(diffMs).toBe(86_399_999)
  })
})

// ─── parseDateOnly ──────────────────────────────────────────

describe('parseDateOnly', () => {
  it('should parse YYYY-MM-DD to UTC midnight', () => {
    const result = parseDateOnly('2026-07-15')
    expect(result.getUTCFullYear()).toBe(2026)
    expect(result.getUTCMonth()).toBe(6) // 0-indexed
    expect(result.getUTCDate()).toBe(15)
    expect(result.getUTCHours()).toBe(0)
  })

  it('should parse January 1st correctly', () => {
    const result = parseDateOnly('2026-01-01')
    expect(result.getUTCMonth()).toBe(0)
    expect(result.getUTCDate()).toBe(1)
  })

  it('should parse December 31st correctly', () => {
    const result = parseDateOnly('2026-12-31')
    expect(result.getUTCMonth()).toBe(11)
    expect(result.getUTCDate()).toBe(31)
  })

  it('should parse leap day correctly', () => {
    const result = parseDateOnly('2028-02-29')
    expect(result.getUTCMonth()).toBe(1)
    expect(result.getUTCDate()).toBe(29)
  })

  it('should set UTC hours/minutes/seconds/ms to zero', () => {
    const result = parseDateOnly('2026-06-15')
    expect(result.getUTCHours()).toBe(0)
    expect(result.getUTCMinutes()).toBe(0)
    expect(result.getUTCSeconds()).toBe(0)
    expect(result.getUTCMilliseconds()).toBe(0)
  })

  // Codex Gate 1 [MED]: invalid date normalizes (no rejection)
  it('should normalize invalid date 2024-02-31 to March (Date.UTC behavior)', () => {
    const result = parseDateOnly('2024-02-31')
    // Feb 31 → March 2 in a leap year (2024: Feb has 29 days, +2 = March 2)
    expect(result.getUTCMonth()).toBe(2) // March
    expect(result.getUTCDate()).toBe(2)
  })
})
