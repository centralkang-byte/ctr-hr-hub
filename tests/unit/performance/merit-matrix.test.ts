import { describe, it, expect } from 'vitest'
import {
  getComparatioBand,
  calculateComparatio,
  checkMeritException,
} from '@/lib/performance/merit-matrix'

// ─── getComparatioBand ─────────────────────────────────────

describe('getComparatioBand', () => {
  it('should return LOW when below 0.9', () => {
    expect(getComparatioBand(0.85)).toBe('LOW')
  })

  it('should return MID when between 0.9 and 1.1 inclusive', () => {
    expect(getComparatioBand(1.0)).toBe('MID')
    expect(getComparatioBand(0.9)).toBe('MID')
    expect(getComparatioBand(1.1)).toBe('MID')
  })

  it('should return HIGH when above 1.1', () => {
    expect(getComparatioBand(1.15)).toBe('HIGH')
  })

  it('should return LOW at just-below threshold (0.899)', () => {
    expect(getComparatioBand(0.899)).toBe('LOW')
  })

  it('should return HIGH at just-above threshold (1.101)', () => {
    expect(getComparatioBand(1.101)).toBe('HIGH')
  })
})

// ─── calculateComparatio ───────────────────────────────────

describe('calculateComparatio', () => {
  it('should calculate ratio of salary to midpoint', () => {
    expect(calculateComparatio(5_000_000, 5_000_000)).toBe(1.0)
  })

  it('should round to 2 decimal places', () => {
    expect(calculateComparatio(6_000_000, 5_000_000)).toBe(1.2)
  })

  it('should return 1.0 when midpoint is null', () => {
    expect(calculateComparatio(5_000_000, null)).toBe(1.0)
  })

  it('should return 1.0 when midpoint is zero', () => {
    expect(calculateComparatio(5_000_000, 0)).toBe(1.0)
  })
})

// ─── checkMeritException ───────────────────────────────────

describe('checkMeritException', () => {
  it('should return WITHIN when applied is in range', () => {
    expect(checkMeritException(5, 3, 7)).toEqual({ isException: false, direction: 'WITHIN' })
  })

  it('should return ABOVE_MAX when applied exceeds max', () => {
    expect(checkMeritException(8, 3, 7)).toEqual({ isException: true, direction: 'ABOVE_MAX' })
  })

  it('should return BELOW_MIN when applied is under min', () => {
    expect(checkMeritException(2, 3, 7)).toEqual({ isException: true, direction: 'BELOW_MIN' })
  })
})
