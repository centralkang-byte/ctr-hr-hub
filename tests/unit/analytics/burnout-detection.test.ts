import { describe, it, expect } from 'vitest'
import { detectBurnout, type BurnoutInput } from '@/lib/analytics/burnout-detection'

// ─── Helpers ────────────────────────────────────────────────

/** Generate weekly overtime history of given length with given avg hours */
function overtimeHistory(weeks: number, avgHours: number): number[] {
  return Array.from({ length: weeks }, () => avgHours)
}

function makeInput(overrides: Partial<BurnoutInput> = {}): BurnoutInput {
  return {
    weeklyOvertimeHistory: [],
    leaveUsageRate: 0.5,
    lastGrade: 'M',
    prevGrade: 'M',
    ...overrides,
  }
}

// ─── 0 of 3 conditions ─────────────────────────────────────

describe('detectBurnout — no conditions met', () => {
  it('should not be at risk when no conditions met', () => {
    const result = detectBurnout(makeInput({
      weeklyOvertimeHistory: overtimeHistory(12, 5), // low overtime
      leaveUsageRate: 0.5,  // 50% usage
      lastGrade: 'M',
      prevGrade: 'M',      // no decline
    }))
    expect(result.isAtRisk).toBe(false)
    expect(result.conditionsMet).toBe(0)
    expect(result.triggeredConditions).toHaveLength(0)
  })
})

// ─── Single conditions (should NOT trigger risk) ────────────

describe('detectBurnout — single condition', () => {
  it('should not trigger with only sustained overtime', () => {
    const result = detectBurnout(makeInput({
      weeklyOvertimeHistory: overtimeHistory(12, 15), // high overtime
      leaveUsageRate: 0.5,
      lastGrade: 'M',
      prevGrade: 'M',
    }))
    expect(result.isAtRisk).toBe(false)
    expect(result.conditionsMet).toBe(1)
  })

  it('should not trigger with only low leave usage', () => {
    const result = detectBurnout(makeInput({
      weeklyOvertimeHistory: overtimeHistory(12, 5),
      leaveUsageRate: 0.1, // < 20%
      lastGrade: 'M',
      prevGrade: 'M',
    }))
    expect(result.isAtRisk).toBe(false)
    expect(result.conditionsMet).toBe(1)
  })

  it('should not trigger with only performance decline', () => {
    const result = detectBurnout(makeInput({
      weeklyOvertimeHistory: overtimeHistory(12, 5),
      leaveUsageRate: 0.5,
      lastGrade: 'S',      // dropped from M to S
      prevGrade: 'M',
    }))
    expect(result.isAtRisk).toBe(false)
    expect(result.conditionsMet).toBe(1)
  })
})

// ─── Pairs (should trigger risk) ────────────────────────────

describe('detectBurnout — pairs of conditions', () => {
  it('should trigger with overtime + low leave', () => {
    const result = detectBurnout(makeInput({
      weeklyOvertimeHistory: overtimeHistory(12, 15),
      leaveUsageRate: 0.1,
      lastGrade: 'M',
      prevGrade: 'M',
    }))
    expect(result.isAtRisk).toBe(true)
    expect(result.conditionsMet).toBe(2)
  })

  it('should trigger with overtime + performance decline', () => {
    const result = detectBurnout(makeInput({
      weeklyOvertimeHistory: overtimeHistory(12, 15),
      leaveUsageRate: 0.5,
      lastGrade: 'S',
      prevGrade: 'M',
    }))
    expect(result.isAtRisk).toBe(true)
    expect(result.conditionsMet).toBe(2)
  })

  it('should trigger with low leave + performance decline', () => {
    const result = detectBurnout(makeInput({
      weeklyOvertimeHistory: overtimeHistory(12, 5),
      leaveUsageRate: 0.1,
      lastGrade: 'S',
      prevGrade: 'M',
    }))
    expect(result.isAtRisk).toBe(true)
    expect(result.conditionsMet).toBe(2)
  })
})

// ─── All 3 conditions ───────────────────────────────────────

describe('detectBurnout — all conditions', () => {
  it('should trigger with all 3 conditions', () => {
    const result = detectBurnout(makeInput({
      weeklyOvertimeHistory: overtimeHistory(12, 15),
      leaveUsageRate: 0.1,
      lastGrade: 'S',
      prevGrade: 'M',
    }))
    expect(result.isAtRisk).toBe(true)
    expect(result.conditionsMet).toBe(3)
    expect(result.triggeredConditions).toHaveLength(3)
  })
})

// ─── Edge cases ─────────────────────────────────────────────

describe('detectBurnout — edge cases', () => {
  it('should handle empty overtime history', () => {
    const result = detectBurnout(makeInput({
      weeklyOvertimeHistory: [],
      leaveUsageRate: 0.1,
      lastGrade: 'S',
      prevGrade: 'M',
    }))
    // Only 2 conditions can fire (leave + perf), overtime skipped
    expect(result.isAtRisk).toBe(true)
    expect(result.conditionsMet).toBe(2)
  })

  // Codex #1: monthBlocks.length >= 2 means 8 weeks can trigger
  it('should trigger overtime condition with only 8 weeks of data', () => {
    const result = detectBurnout(makeInput({
      weeklyOvertimeHistory: overtimeHistory(8, 15),
      leaveUsageRate: 0.5,
      lastGrade: 'M',
      prevGrade: 'M',
    }))
    // 8 weeks → 2 blocks of 4 → monthBlocks.length >= 2 → condition fires
    expect(result.conditionsMet).toBe(1)
    expect(result.triggeredConditions[0]).toContain('10h+')
  })

  it('should NOT trigger overtime with only 4 weeks (1 block)', () => {
    const result = detectBurnout(makeInput({
      weeklyOvertimeHistory: overtimeHistory(4, 15),
      leaveUsageRate: 0.5,
      lastGrade: 'M',
      prevGrade: 'M',
    }))
    // 4 weeks → 1 block of 4 + 0 + 0 = only 1 non-empty block
    // filter removes empty blocks, but block[0] has 4, block[1] has 0, block[2] has 0
    // Actually: slice(0,4)=[15x4], slice(4,8)=[], slice(8,12)=[]
    // filter(block => block.length > 0) → only 1 block → < 2 → no trigger
    expect(result.triggeredConditions.some(c => c.includes('10h+'))).toBe(false)
  })

  it('should handle 9-week history (2 non-empty blocks)', () => {
    const result = detectBurnout(makeInput({
      weeklyOvertimeHistory: overtimeHistory(9, 15),
      leaveUsageRate: 0.5,
      lastGrade: 'M',
      prevGrade: 'M',
    }))
    // slice(-12) = all 9, blocks: [4, 4, 1] → 3 non-empty → all high → triggers
    expect(result.triggeredConditions.some(c => c.includes('10h+'))).toBe(true)
  })

  it('should handle grade not in GRADE_ORDER', () => {
    const result = detectBurnout(makeInput({
      weeklyOvertimeHistory: overtimeHistory(12, 5),
      leaveUsageRate: 0.5,
      lastGrade: 'X',      // not in O/E/M/S
      prevGrade: 'M',
    }))
    // indexOf returns -1, condition check fails → no performance decline
    expect(result.triggeredConditions.some(c => c.includes('하락'))).toBe(false)
  })

  it('should not detect decline for same grade', () => {
    const result = detectBurnout(makeInput({
      weeklyOvertimeHistory: overtimeHistory(12, 5),
      leaveUsageRate: 0.5,
      lastGrade: 'E',
      prevGrade: 'E',
    }))
    expect(result.triggeredConditions.some(c => c.includes('하락'))).toBe(false)
  })

  it('should not detect decline for grade improvement (S→M)', () => {
    const result = detectBurnout(makeInput({
      weeklyOvertimeHistory: overtimeHistory(12, 5),
      leaveUsageRate: 0.5,
      lastGrade: 'M',
      prevGrade: 'S',      // improved
    }))
    expect(result.triggeredConditions.some(c => c.includes('하락'))).toBe(false)
  })

  it('should handle null grades', () => {
    const result = detectBurnout(makeInput({
      weeklyOvertimeHistory: overtimeHistory(12, 5),
      leaveUsageRate: 0.5,
      lastGrade: null,
      prevGrade: null,
    }))
    expect(result.triggeredConditions.some(c => c.includes('하락'))).toBe(false)
  })
})
