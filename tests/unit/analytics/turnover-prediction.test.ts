import { describe, it, expect } from 'vitest'
import { calculateTurnoverRisk, TurnoverRiskInput } from '@/lib/analytics/turnover-prediction'

// ─── Helper ─────────────────────────────────────────────────

/** Zero-risk baseline — all factors below thresholds */
function makeInput(overrides: Partial<TurnoverRiskInput> = {}): TurnoverRiskInput {
  return {
    compaRatio: 1.1,
    lastGrade: 'M',
    prevGrade: 'M',
    avgWeeklyOvertime: 4,
    leaveUsageRate: 0.6,
    tenureYears: 5,
    managerChanges: 0,
    samePositionYears: 1,
    ...overrides,
  }
}

// ─── Factor 1: compaRatio (25%) ─────────────────────────────

describe('calculateTurnoverRisk — compaRatio factor', () => {
  it('should add 25 when compaRatio < 0.8', () => {
    const result = calculateTurnoverRisk(makeInput({ compaRatio: 0.75 }))
    expect(result.score).toBe(25)
  })

  it('should add 25 at boundary compaRatio = 0.79', () => {
    const result = calculateTurnoverRisk(makeInput({ compaRatio: 0.79 }))
    expect(result.score).toBe(25)
  })

  it('should add 15 when compaRatio is 0.8 (>= 0.8, < 0.9)', () => {
    const result = calculateTurnoverRisk(makeInput({ compaRatio: 0.8 }))
    expect(result.score).toBe(15)
  })

  it('should add 5 when compaRatio is 0.9 (>= 0.9, < 1.0)', () => {
    const result = calculateTurnoverRisk(makeInput({ compaRatio: 0.9 }))
    expect(result.score).toBe(5)
  })

  it('should add 0 when compaRatio >= 1.0', () => {
    const result = calculateTurnoverRisk(makeInput({ compaRatio: 1.0 }))
    expect(result.score).toBe(0)
  })

  it('should skip compaRatio factor when null', () => {
    const result = calculateTurnoverRisk(makeInput({ compaRatio: null }))
    expect(result.score).toBe(0)
  })
})

// ─── Factor 2: performance grade (20%) ──────────────────────

describe('calculateTurnoverRisk — performance grade factor', () => {
  it('should add 20 for grade S (low performer)', () => {
    const result = calculateTurnoverRisk(makeInput({ lastGrade: 'S' }))
    expect(result.score).toBe(20)
  })

  it('should add 0 for grade M', () => {
    const result = calculateTurnoverRisk(makeInput({ lastGrade: 'M' }))
    expect(result.score).toBe(0)
  })

  it('should add 20 for O-grade with compaRatio < 0.95 (high performer flight risk)', () => {
    // compaRatio 0.90 adds 5 (ratio) + 20 (O+lowpay) = 25
    const result = calculateTurnoverRisk(makeInput({ lastGrade: 'O', compaRatio: 0.90 }))
    expect(result.score).toBe(25)
  })

  it('should not add O-grade bonus when compaRatio >= 0.95', () => {
    const result = calculateTurnoverRisk(makeInput({ lastGrade: 'O', compaRatio: 1.0 }))
    expect(result.score).toBe(0)
  })
})

// ─── Factor 3: overtime (15%) ───────────────────────────────

describe('calculateTurnoverRisk — overtime factor', () => {
  it('should add 15 when avgWeeklyOvertime >= 15', () => {
    const result = calculateTurnoverRisk(makeInput({ avgWeeklyOvertime: 15 }))
    expect(result.score).toBe(15)
  })

  it('should add 8 when avgWeeklyOvertime >= 8 and < 15', () => {
    const result = calculateTurnoverRisk(makeInput({ avgWeeklyOvertime: 10 }))
    expect(result.score).toBe(8)
  })

  it('should add 0 when avgWeeklyOvertime < 8', () => {
    const result = calculateTurnoverRisk(makeInput({ avgWeeklyOvertime: 7.9 }))
    expect(result.score).toBe(0)
  })
})

// ─── Factor 4: leave usage (10%) ────────────────────────────

describe('calculateTurnoverRisk — leave usage factor', () => {
  it('should add 10 when leaveUsageRate < 0.2', () => {
    const result = calculateTurnoverRisk(makeInput({ leaveUsageRate: 0.1 }))
    expect(result.score).toBe(10)
  })

  it('should add 0 when leaveUsageRate >= 0.2', () => {
    const result = calculateTurnoverRisk(makeInput({ leaveUsageRate: 0.2 }))
    expect(result.score).toBe(0)
  })
})

// ─── Factor 5: tenure (10%) ─────────────────────────────────

describe('calculateTurnoverRisk — tenure factor', () => {
  it('should add 10 when tenureYears between 1 and 2', () => {
    const result = calculateTurnoverRisk(makeInput({ tenureYears: 1.5 }))
    expect(result.score).toBe(10)
  })

  it('should add 10 at exactly 1 year', () => {
    const result = calculateTurnoverRisk(makeInput({ tenureYears: 1 }))
    expect(result.score).toBe(10)
  })

  it('should add 10 at exactly 2 years', () => {
    const result = calculateTurnoverRisk(makeInput({ tenureYears: 2 }))
    expect(result.score).toBe(10)
  })

  it('should add 0 when tenureYears > 2', () => {
    const result = calculateTurnoverRisk(makeInput({ tenureYears: 2.1 }))
    expect(result.score).toBe(0)
  })
})

// ─── Factor 6: manager changes (10%) ────────────────────────

describe('calculateTurnoverRisk — manager changes factor', () => {
  it('should add 10 when managerChanges >= 2', () => {
    const result = calculateTurnoverRisk(makeInput({ managerChanges: 2 }))
    expect(result.score).toBe(10)
  })

  it('should add 0 when managerChanges < 2', () => {
    const result = calculateTurnoverRisk(makeInput({ managerChanges: 1 }))
    expect(result.score).toBe(0)
  })
})

// ─── Factor 7: position stagnation (10%) ────────────────────

describe('calculateTurnoverRisk — position stagnation factor', () => {
  it('should add 10 when samePositionYears >= 3', () => {
    const result = calculateTurnoverRisk(makeInput({ samePositionYears: 3 }))
    expect(result.score).toBe(10)
  })

  it('should add 0 when samePositionYears < 3', () => {
    const result = calculateTurnoverRisk(makeInput({ samePositionYears: 2.9 }))
    expect(result.score).toBe(0)
  })
})

// ─── Score capping & level classification ───────────────────

describe('calculateTurnoverRisk — score and level', () => {
  it('should cap score at 100 for max-risk input', () => {
    const result = calculateTurnoverRisk(makeInput({
      compaRatio: 0.75,   // 25
      lastGrade: 'S',     // 20
      avgWeeklyOvertime: 20, // 15
      leaveUsageRate: 0.05,  // 10
      tenureYears: 1.5,   // 10
      managerChanges: 3,  // 10
      samePositionYears: 5, // 10
    }))
    // Total would be 100 — at the cap
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.level).toBe('HIGH')
  })

  it('should return HIGH level when score >= 70', () => {
    const result = calculateTurnoverRisk(makeInput({
      compaRatio: 0.75, // 25
      lastGrade: 'S',   // 20
      avgWeeklyOvertime: 20, // 15
      leaveUsageRate: 0.05,  // 10
    }))
    expect(result.score).toBe(70)
    expect(result.level).toBe('HIGH')
  })

  it('should return MEDIUM level when score >= 40 and < 70', () => {
    const result = calculateTurnoverRisk(makeInput({
      compaRatio: 0.75,      // 25
      avgWeeklyOvertime: 20, // 15
    }))
    expect(result.score).toBe(40)
    expect(result.level).toBe('MEDIUM')
  })

  it('should return LOW level when score < 40', () => {
    const result = calculateTurnoverRisk(makeInput())
    expect(result.score).toBe(0)
    expect(result.level).toBe('LOW')
  })

  it('should sort factors by contribution descending', () => {
    const result = calculateTurnoverRisk(makeInput({
      compaRatio: 0.75,   // 25
      leaveUsageRate: 0.1, // 10
      managerChanges: 3,   // 10
    }))
    expect(result.factors.length).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < result.factors.length; i++) {
      expect(result.factors[i - 1].contribution).toBeGreaterThanOrEqual(result.factors[i].contribution)
    }
  })

  // Codex Gate 1 [MED]: prevGrade is defined but never used
  it('should not change score when prevGrade differs (unused input)', () => {
    const base = calculateTurnoverRisk(makeInput({ prevGrade: 'M' }))
    const changed = calculateTurnoverRisk(makeInput({ prevGrade: 'O' }))
    expect(base.score).toBe(changed.score)
  })
})
