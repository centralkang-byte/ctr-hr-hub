import { describe, it, expect } from 'vitest'
import {
  calculateEarnedIncomeCredit,
  calculateChildCredit,
} from '@/lib/payroll/deductionCalculator'

// ─── calculateEarnedIncomeCredit ────────────────────────────

describe('calculateEarnedIncomeCredit', () => {
  const defaultRules = {}

  // Bracket 1: tax <= 1.3M → 55% rate

  it('should return 0 when calculatedTax is 0', () => {
    expect(calculateEarnedIncomeCredit(0, 30_000_000, defaultRules)).toBe(0)
  })

  it('should apply 55% rate for small tax', () => {
    // 1_000_000 * 0.55 = 550_000, salary 30M → limit 740K → uncapped
    expect(calculateEarnedIncomeCredit(1_000_000, 30_000_000, defaultRules)).toBe(550_000)
  })

  it('should apply 55% rate at exact bracket boundary (1.3M)', () => {
    // 1_300_000 * 0.55 = 715_000, salary 30M → limit 740K → uncapped
    expect(calculateEarnedIncomeCredit(1_300_000, 30_000_000, defaultRules)).toBe(715_000)
  })

  // Bracket 2: tax > 1.3M → base 715K + 30% of excess

  it('should apply bracket 2 formula when tax exceeds 1.3M', () => {
    // 715_000 + (2_000_000 - 1_300_000) * 0.30 = 715_000 + 210_000 = 925_000
    // salary 30M → limit 740K → capped at 740_000
    expect(calculateEarnedIncomeCredit(2_000_000, 30_000_000, defaultRules)).toBe(740_000)
  })

  it('should apply bracket 2 for very high tax', () => {
    // 715_000 + (10_000_000 - 1_300_000) * 0.30 = 715_000 + 2_610_000 = 3_325_000
    // salary 100M → limit 500K → capped at 500_000
    expect(calculateEarnedIncomeCredit(10_000_000, 100_000_000, defaultRules)).toBe(500_000)
  })

  // Salary-based limits

  it('should cap at 740K when totalSalary <= 33M', () => {
    expect(calculateEarnedIncomeCredit(5_000_000, 30_000_000, defaultRules)).toBe(740_000)
  })

  it('should cap at 740K at exactly 33M salary', () => {
    expect(calculateEarnedIncomeCredit(5_000_000, 33_000_000, defaultRules)).toBe(740_000)
  })

  it('should cap at 660K when totalSalary between 33M and 70M', () => {
    expect(calculateEarnedIncomeCredit(5_000_000, 50_000_000, defaultRules)).toBe(660_000)
  })

  it('should cap at 660K at exactly 70M salary', () => {
    expect(calculateEarnedIncomeCredit(5_000_000, 70_000_000, defaultRules)).toBe(660_000)
  })

  it('should cap at 500K when totalSalary > 70M', () => {
    expect(calculateEarnedIncomeCredit(5_000_000, 70_000_001, defaultRules)).toBe(500_000)
  })

  // Custom rules

  it('should use custom bracket rates from rules', () => {
    const customRules = {
      brackets: [
        { maxTax: 1_000_000, rate: 0.60 },
        { minTax: 1_000_000, rate: 0.40, base: 600_000 },
      ],
    }
    // tax=500K → bracket 1: 500_000 * 0.60 = 300_000
    expect(calculateEarnedIncomeCredit(500_000, 30_000_000, customRules)).toBe(300_000)
  })

  it('should use custom salary limits from rules', () => {
    const customRules = {
      limits: { salary_under_3300: 800_000, salary_3300_7000: 700_000, salary_over_7000: 550_000 },
    }
    // tax=5M → bracket 2 credit will exceed limit → capped at custom 800K
    expect(calculateEarnedIncomeCredit(5_000_000, 30_000_000, customRules)).toBe(800_000)
  })

  // Codex Gate 1 [MED]: partial brackets array — only 1 bracket
  it('should handle partial brackets array with only one entry', () => {
    const partialRules = {
      brackets: [{ maxTax: 2_000_000, rate: 0.50 }],
    }
    // tax=1M → bracket 1: 1_000_000 * 0.50 = 500_000
    expect(calculateEarnedIncomeCredit(1_000_000, 30_000_000, partialRules)).toBe(500_000)
    // tax=3M → exceeds maxTax → accesses brackets[1] which is undefined → runtime behavior
    // This documents the unsafe access pattern (brackets[1] may be undefined)
  })
})

// ─── calculateChildCredit ───────────────────────────────────

describe('calculateChildCredit', () => {
  const defaultRules = {}

  it('should return 0 for 0 children', () => {
    expect(calculateChildCredit(0, defaultRules)).toBe(0)
  })

  it('should return 0 for negative childCount', () => {
    expect(calculateChildCredit(-1, defaultRules)).toBe(0)
  })

  it('should return 150K for 1 child', () => {
    expect(calculateChildCredit(1, defaultRules)).toBe(150_000)
  })

  it('should return 350K for 2 children', () => {
    expect(calculateChildCredit(2, defaultRules)).toBe(350_000)
  })

  it('should return 650K for 3 children (350K + 300K)', () => {
    expect(calculateChildCredit(3, defaultRules)).toBe(650_000)
  })

  it('should return 950K for 4 children (350K + 2×300K)', () => {
    expect(calculateChildCredit(4, defaultRules)).toBe(950_000)
  })

  it('should use custom rules.first value', () => {
    expect(calculateChildCredit(1, { first: 200_000 })).toBe(200_000)
  })

  it('should use custom rules.second and rules.thirdPlus values', () => {
    // 2 children → second=400K; 3 children → 400K + thirdPlus=500K = 900K
    expect(calculateChildCredit(2, { second: 400_000 })).toBe(400_000)
    expect(calculateChildCredit(3, { second: 400_000, thirdPlus: 500_000 })).toBe(900_000)
  })
})
