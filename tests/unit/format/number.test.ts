import { describe, it, expect } from 'vitest'
import {
  formatNumber,
  formatCurrency,
  formatCompact,
  formatPercent,
  formatPercentRaw,
} from '@/lib/format/number'

// ─── formatNumber ──────────────────────────────────────────

describe('formatNumber', () => {
  it('should return - for null', () => {
    expect(formatNumber(null)).toBe('-')
  })

  it('should return - for undefined', () => {
    expect(formatNumber(undefined)).toBe('-')
  })

  it('should format with thousand separators', () => {
    expect(formatNumber(3_200_000)).toBe('3,200,000')
  })

  it('should format zero', () => {
    expect(formatNumber(0)).toBe('0')
  })
})

// ─── formatCurrency ────────────────────────────────────────

describe('formatCurrency', () => {
  it('should return - for null', () => {
    expect(formatCurrency(null)).toBe('-')
  })

  it('should format KRW with ₩ symbol', () => {
    expect(formatCurrency(3_200_000, 'KRW')).toBe('₩3,200,000')
  })

  it('should format USD with $ symbol', () => {
    expect(formatCurrency(1_500, 'USD')).toBe('$1,500')
  })

  it('should use code + space for unknown currency', () => {
    expect(formatCurrency(1_000, 'GBP')).toBe('GBP 1,000')
  })
})

// ─── formatCompact ─────────────────────────────────────────

describe('formatCompact', () => {
  it('should return - for null', () => {
    expect(formatCompact(null)).toBe('-')
  })

  it('should format billions (억)', () => {
    expect(formatCompact(2_100_000_000)).toBe('₩21억')
  })

  it('should format ten-thousands (만)', () => {
    expect(formatCompact(3_200_000)).toBe('₩320만')
  })

  it('should format small numbers with full format', () => {
    expect(formatCompact(500)).toBe('₩500')
  })

  it('should handle negative values', () => {
    expect(formatCompact(-2_100_000_000)).toBe('-₩21억')
  })
})

// ─── formatPercent ─────────────────────────────────────────

describe('formatPercent', () => {
  it('should return - for null', () => {
    expect(formatPercent(null)).toBe('-')
  })

  it('should convert ratio to percentage', () => {
    expect(formatPercent(0.156)).toBe('15.6%')
  })

  it('should respect custom decimal places', () => {
    expect(formatPercent(0.156, 2)).toBe('15.60%')
  })
})

// ─── formatPercentRaw ──────────────────────────────────────

describe('formatPercentRaw', () => {
  it('should return - for null', () => {
    expect(formatPercentRaw(null)).toBe('-')
  })

  it('should format already-percentage value', () => {
    expect(formatPercentRaw(15.6)).toBe('15.6%')
  })
})
