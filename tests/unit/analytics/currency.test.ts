// ═══════════════════════════════════════════════════════════
// Unit Tests — Currency Conversion Utilities
// src/lib/analytics/currency.ts
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { convertToKRW, formatCurrency, EXCHANGE_RATES_TO_KRW } from '@/lib/analytics/currency'

// ─── convertToKRW ───────────────────────────────────────────

describe('convertToKRW', () => {
  it('should return same amount for KRW (rate=1)', () => {
    expect(convertToKRW(1000, 'KRW')).toBe(1000)
  })

  it('should convert USD to KRW', () => {
    expect(convertToKRW(1000, 'USD')).toBe(1_400_000)
  })

  it('should convert CNY to KRW', () => {
    expect(convertToKRW(1000, 'CNY')).toBe(190_000)
  })

  it('should convert EUR to KRW', () => {
    expect(convertToKRW(1000, 'EUR')).toBe(1_500_000)
  })

  it('should convert VND to KRW', () => {
    expect(convertToKRW(1_000_000, 'VND')).toBe(55_000)
  })

  it('should convert RUB to KRW', () => {
    expect(convertToKRW(1000, 'RUB')).toBe(15_000)
  })

  it('should convert MXN to KRW', () => {
    expect(convertToKRW(1000, 'MXN')).toBe(78_000)
  })

  it('should default to rate=1 for unknown currency', () => {
    expect(convertToKRW(500, 'GBP')).toBe(500)
  })

  it('should return 0 for zero amount', () => {
    expect(convertToKRW(0, 'USD')).toBe(0)
  })

  it('should round fractional result (VND)', () => {
    // 100 * 0.055 = 5.5 → Math.round = 6
    expect(convertToKRW(100, 'VND')).toBe(Math.round(100 * 0.055))
  })

  it('should have 7 currencies in exchange rate map', () => {
    expect(Object.keys(EXCHANGE_RATES_TO_KRW)).toHaveLength(7)
  })
})

// ─── formatCurrency ─────────────────────────────────────────

describe('formatCurrency', () => {
  it('should format billions with B suffix', () => {
    expect(formatCurrency(2_000_000_000, 'KRW')).toBe('₩2.0B')
  })

  it('should format millions with M suffix', () => {
    expect(formatCurrency(5_500_000, 'USD')).toBe('$5.5M')
  })

  it('should format thousands with K suffix', () => {
    expect(formatCurrency(1_500, 'EUR')).toBe('€1.5K')
  })

  // Codex G1: toLocaleString() is locale-sensitive — use pattern matching
  it('should format below 1000 with currency symbol', () => {
    const result = formatCurrency(999, 'KRW')
    expect(result).toContain('₩')
    expect(result).toContain('999')
  })

  it('should use currency code for unknown symbol', () => {
    const result = formatCurrency(500, 'GBP')
    expect(result).toContain('GBP')
  })

  // Seam boundary tests (Codex recommendation)
  it('should use K format at exactly 1000', () => {
    expect(formatCurrency(1000, 'KRW')).toBe('₩1.0K')
  })

  it('should use M format at exactly 1_000_000', () => {
    expect(formatCurrency(1_000_000, 'USD')).toBe('$1.0M')
  })
})
