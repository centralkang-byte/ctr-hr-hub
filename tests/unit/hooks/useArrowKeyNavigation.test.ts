import { describe, it, expect } from 'vitest'
import { computeNextIndex } from '@/hooks/useArrowKeyNavigation'

// ─── Helpers ────────────────────────────────────────────────

type Orientation = 'horizontal' | 'vertical'

function opts(
  orientation: Orientation,
  loop: boolean,
  rtl = false,
): { orientation: Orientation; loop: boolean; rtl: boolean } {
  return { orientation, loop, rtl }
}

// ─── Tests ──────────────────────────────────────────────────

describe('computeNextIndex — horizontal + loop=true', () => {
  const o = opts('horizontal', true)

  it('ArrowRight from 0 → 1', () => {
    expect(computeNextIndex('ArrowRight', 0, 4, o)).toBe(1)
  })
  it('ArrowRight from last wraps to 0', () => {
    expect(computeNextIndex('ArrowRight', 3, 4, o)).toBe(0)
  })
  it('ArrowLeft from 1 → 0', () => {
    expect(computeNextIndex('ArrowLeft', 1, 4, o)).toBe(0)
  })
  it('ArrowLeft from 0 wraps to last', () => {
    expect(computeNextIndex('ArrowLeft', 0, 4, o)).toBe(3)
  })
})

describe('computeNextIndex — horizontal + loop=false', () => {
  const o = opts('horizontal', false)

  it('ArrowRight from last clamps to last', () => {
    expect(computeNextIndex('ArrowRight', 3, 4, o)).toBe(3)
  })
  it('ArrowLeft from 0 clamps to 0', () => {
    expect(computeNextIndex('ArrowLeft', 0, 4, o)).toBe(0)
  })
  it('ArrowRight middle moves forward', () => {
    expect(computeNextIndex('ArrowRight', 1, 4, o)).toBe(2)
  })
})

describe('computeNextIndex — horizontal + rtl=true', () => {
  const o = opts('horizontal', true, true)

  it('ArrowRight from 1 → 0 (rtl reverses)', () => {
    expect(computeNextIndex('ArrowRight', 1, 4, o)).toBe(0)
  })
  it('ArrowLeft from 0 → 1 (rtl reverses, no wrap needed)', () => {
    expect(computeNextIndex('ArrowLeft', 0, 4, o)).toBe(1)
  })
})

describe('computeNextIndex — vertical + loop=true', () => {
  const o = opts('vertical', true)

  it('ArrowDown from 0 → 1', () => {
    expect(computeNextIndex('ArrowDown', 0, 4, o)).toBe(1)
  })
  it('ArrowDown from last wraps to 0', () => {
    expect(computeNextIndex('ArrowDown', 3, 4, o)).toBe(0)
  })
  it('ArrowUp from 0 wraps to last', () => {
    expect(computeNextIndex('ArrowUp', 0, 4, o)).toBe(3)
  })
  it('ArrowUp from 2 → 1', () => {
    expect(computeNextIndex('ArrowUp', 2, 4, o)).toBe(1)
  })
})

describe('computeNextIndex — vertical + loop=false', () => {
  const o = opts('vertical', false)

  it('ArrowDown from last clamps to last', () => {
    expect(computeNextIndex('ArrowDown', 3, 4, o)).toBe(3)
  })
  it('ArrowUp from 0 clamps to 0', () => {
    expect(computeNextIndex('ArrowUp', 0, 4, o)).toBe(0)
  })
})

describe('computeNextIndex — orientation mismatch ignored', () => {
  it('horizontal ignores ArrowUp', () => {
    expect(computeNextIndex('ArrowUp', 1, 4, opts('horizontal', true))).toBeNull()
  })
  it('horizontal ignores ArrowDown', () => {
    expect(computeNextIndex('ArrowDown', 1, 4, opts('horizontal', true))).toBeNull()
  })
  it('vertical ignores ArrowLeft', () => {
    expect(computeNextIndex('ArrowLeft', 1, 4, opts('vertical', true))).toBeNull()
  })
  it('vertical ignores ArrowRight', () => {
    expect(computeNextIndex('ArrowRight', 1, 4, opts('vertical', true))).toBeNull()
  })
})

describe('computeNextIndex — Home / End', () => {
  it('Home returns 0 (horizontal)', () => {
    expect(computeNextIndex('Home', 3, 4, opts('horizontal', true))).toBe(0)
  })
  it('End returns last (horizontal)', () => {
    expect(computeNextIndex('End', 0, 4, opts('horizontal', true))).toBe(3)
  })
  it('Home returns 0 (vertical)', () => {
    expect(computeNextIndex('Home', 3, 4, opts('vertical', false))).toBe(0)
  })
  it('End returns last (vertical, loop=false irrelevant)', () => {
    expect(computeNextIndex('End', 0, 4, opts('vertical', false))).toBe(3)
  })
})

describe('computeNextIndex — PageUp / PageDown (5-step)', () => {
  it('PageDown from 0 with 10 items → 5', () => {
    expect(computeNextIndex('PageDown', 0, 10, opts('horizontal', true))).toBe(5)
  })
  it('PageDown clamps to last (no wrap)', () => {
    expect(computeNextIndex('PageDown', 8, 10, opts('horizontal', true))).toBe(9)
  })
  it('PageUp from 9 with 10 items → 4', () => {
    expect(computeNextIndex('PageUp', 9, 10, opts('horizontal', true))).toBe(4)
  })
  it('PageUp clamps to 0 (no wrap)', () => {
    expect(computeNextIndex('PageUp', 2, 10, opts('horizontal', true))).toBe(0)
  })
})

describe('computeNextIndex — edge cases', () => {
  it('returns null for unhandled key', () => {
    expect(computeNextIndex('a', 0, 4, opts('horizontal', true))).toBeNull()
  })
  it('returns null for empty list', () => {
    expect(computeNextIndex('ArrowRight', 0, 0, opts('horizontal', true))).toBeNull()
  })
  it('returns null when activeIndex is out of range (negative)', () => {
    expect(computeNextIndex('ArrowRight', -1, 4, opts('horizontal', true))).toBeNull()
  })
  it('returns null when activeIndex is out of range (>= count)', () => {
    expect(computeNextIndex('ArrowRight', 4, 4, opts('horizontal', true))).toBeNull()
  })
  it('single-item list: ArrowRight loop=true stays at 0', () => {
    expect(computeNextIndex('ArrowRight', 0, 1, opts('horizontal', true))).toBe(0)
  })
  it('single-item list: ArrowLeft loop=false stays at 0', () => {
    expect(computeNextIndex('ArrowLeft', 0, 1, opts('horizontal', false))).toBe(0)
  })
})
