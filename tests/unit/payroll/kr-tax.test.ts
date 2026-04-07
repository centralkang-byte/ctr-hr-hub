import { describe, it, expect } from 'vitest'
import {
  calculateHourlyWage,
  calculateSocialInsurance,
  calculateIncomeTax,
  calculateTotalDeductions,
  separateTaxableIncome,
  getWeekdaysInMonth,
  getWeekdaysBetween,
  calculateProrated,
  detectPayrollAnomalies,
  NATIONAL_PENSION_RATE,
  NATIONAL_PENSION_CEILING,
  HEALTH_INSURANCE_RATE,
  LONG_TERM_CARE_RATE,
  EMPLOYMENT_INSURANCE_RATE,
  MONTHLY_STANDARD_HOURS,
  type AllowanceItem,
} from '@/lib/payroll/kr-tax'

// ─── calculateHourlyWage ────────────────────────────────────

describe('calculateHourlyWage', () => {
  it('should calculate standard hourly wage (3,000,000 / 209)', () => {
    expect(calculateHourlyWage(3_000_000)).toBe(Math.round(3_000_000 / MONTHLY_STANDARD_HOURS))
  })

  it('should return 0 for zero salary', () => {
    expect(calculateHourlyWage(0)).toBe(0)
  })

  it('should handle high salary with rounding', () => {
    const salary = 15_000_000
    expect(calculateHourlyWage(salary)).toBe(Math.round(salary / MONTHLY_STANDARD_HOURS))
  })
})

// ─── calculateSocialInsurance ───────────────────────────────

describe('calculateSocialInsurance', () => {
  it('should calculate all 4 insurance types for standard salary', () => {
    const result = calculateSocialInsurance(3_000_000)
    expect(result.nationalPension).toBe(Math.round(3_000_000 * NATIONAL_PENSION_RATE))
    expect(result.healthInsurance).toBe(Math.round(3_000_000 * HEALTH_INSURANCE_RATE))
    expect(result.longTermCare).toBe(Math.round(result.healthInsurance * LONG_TERM_CARE_RATE))
    expect(result.employmentInsurance).toBe(Math.round(3_000_000 * EMPLOYMENT_INSURANCE_RATE))
  })

  it('should cap pension base at ceiling (5,900,000)', () => {
    const result = calculateSocialInsurance(10_000_000)
    expect(result.nationalPension).toBe(Math.round(NATIONAL_PENSION_CEILING * NATIONAL_PENSION_RATE))
  })

  it('should not cap pension below ceiling', () => {
    const result = calculateSocialInsurance(5_000_000)
    expect(result.nationalPension).toBe(Math.round(5_000_000 * NATIONAL_PENSION_RATE))
  })

  it('should return all zeros for zero gross', () => {
    const result = calculateSocialInsurance(0)
    expect(result.nationalPension).toBe(0)
    expect(result.healthInsurance).toBe(0)
    expect(result.longTermCare).toBe(0)
    expect(result.employmentInsurance).toBe(0)
    expect(result.total).toBe(0)
  })

  it('should handle exact pension ceiling', () => {
    const result = calculateSocialInsurance(NATIONAL_PENSION_CEILING)
    expect(result.nationalPension).toBe(Math.round(NATIONAL_PENSION_CEILING * NATIONAL_PENSION_RATE))
  })

  it('should cap pension at ceiling + 1', () => {
    const result = calculateSocialInsurance(NATIONAL_PENSION_CEILING + 1)
    // Pension should still be based on ceiling, not ceiling + 1
    expect(result.nationalPension).toBe(Math.round(NATIONAL_PENSION_CEILING * NATIONAL_PENSION_RATE))
    // But health insurance uses full gross
    expect(result.healthInsurance).toBe(Math.round((NATIONAL_PENSION_CEILING + 1) * HEALTH_INSURANCE_RATE))
  })

  it('should have total equal sum of all components', () => {
    const result = calculateSocialInsurance(4_500_000)
    expect(result.total).toBe(
      result.nationalPension + result.healthInsurance + result.longTermCare + result.employmentInsurance
    )
  })

  it('should calculate long-term care as percentage of health insurance', () => {
    const result = calculateSocialInsurance(3_000_000)
    expect(result.longTermCare).toBe(Math.round(result.healthInsurance * LONG_TERM_CARE_RATE))
  })

  it('should handle very low salary (minimum wage level)', () => {
    const result = calculateSocialInsurance(100_000)
    expect(result.nationalPension).toBe(Math.round(100_000 * NATIONAL_PENSION_RATE))
    expect(result.total).toBeGreaterThan(0)
  })

  it('should handle very high salary (pension capped, others proportional)', () => {
    const result = calculateSocialInsurance(50_000_000)
    expect(result.nationalPension).toBe(Math.round(NATIONAL_PENSION_CEILING * NATIONAL_PENSION_RATE))
    expect(result.healthInsurance).toBe(Math.round(50_000_000 * HEALTH_INSURANCE_RATE))
  })

  it('should use Math.round for each component (not floor/ceil)', () => {
    // Verify rounding behavior: 3,333,333 * 0.045 = 149,999.985 → 150,000
    const result = calculateSocialInsurance(3_333_333)
    expect(result.nationalPension).toBe(Math.round(3_333_333 * NATIONAL_PENSION_RATE))
  })

  it('should apply each rate correctly against known values', () => {
    // 3,000,000 KRW
    const result = calculateSocialInsurance(3_000_000)
    expect(result.nationalPension).toBe(135_000) // 3M * 4.5%
    expect(result.healthInsurance).toBe(106_350) // 3M * 3.545%
    expect(result.longTermCare).toBe(13_623)     // 106,350 * 12.81% = 13,623.135 → 13,623 (Math.round)
    expect(result.employmentInsurance).toBe(27_000) // 3M * 0.9%
  })

  it('should handle salary of 1 KRW', () => {
    const result = calculateSocialInsurance(1)
    expect(result.nationalPension).toBe(Math.round(1 * NATIONAL_PENSION_RATE))
    expect(result.total).toBeGreaterThanOrEqual(0)
  })
})

// ─── calculateIncomeTax ─────────────────────────────────────

describe('calculateIncomeTax', () => {
  it('should return zero tax for zero income', () => {
    const result = calculateIncomeTax(0)
    expect(result.incomeTax).toBe(0)
    expect(result.localIncomeTax).toBe(0)
    expect(result.total).toBe(0)
  })

  it('should calculate local income tax as 10% of income tax', () => {
    const result = calculateIncomeTax(3_000_000)
    expect(result.localIncomeTax).toBe(Math.floor(result.incomeTax * 0.10))
  })

  it('should have total equal incomeTax + localIncomeTax', () => {
    const result = calculateIncomeTax(5_000_000)
    expect(result.total).toBe(result.incomeTax + result.localIncomeTax)
  })

  it('should return non-negative tax for very low income', () => {
    const result = calculateIncomeTax(100_000)
    expect(result.incomeTax).toBeGreaterThanOrEqual(0)
    expect(result.localIncomeTax).toBeGreaterThanOrEqual(0)
  })

  // Bracket boundary tests (Codex #2: seam coverage)
  it('should handle income in first bracket (annual < 14M)', () => {
    // Monthly 1,000,000 → annual 12,000,000 → first bracket (6%)
    const result = calculateIncomeTax(1_000_000)
    expect(result.incomeTax).toBeGreaterThanOrEqual(0)
  })

  it('should handle income crossing 14M bracket boundary', () => {
    // Monthly 1,166,667 → annual ~14,000,004 → just above first bracket
    const resultBelow = calculateIncomeTax(1_166_666)
    const resultAbove = calculateIncomeTax(1_166_667)
    // Tax should increase or stay same (never decrease with higher income)
    expect(resultAbove.incomeTax).toBeGreaterThanOrEqual(resultBelow.incomeTax)
  })

  it('should handle income crossing 50M bracket boundary', () => {
    const resultBelow = calculateIncomeTax(4_166_666)
    const resultAbove = calculateIncomeTax(4_166_667)
    expect(resultAbove.incomeTax).toBeGreaterThanOrEqual(resultBelow.incomeTax)
  })

  it('should handle income crossing 88M bracket boundary', () => {
    const resultBelow = calculateIncomeTax(7_333_333)
    const resultAbove = calculateIncomeTax(7_333_334)
    expect(resultAbove.incomeTax).toBeGreaterThanOrEqual(resultBelow.incomeTax)
  })

  it('should handle income crossing 150M bracket boundary', () => {
    const resultBelow = calculateIncomeTax(12_500_000)
    const resultAbove = calculateIncomeTax(12_500_001)
    expect(resultAbove.incomeTax).toBeGreaterThanOrEqual(resultBelow.incomeTax)
  })

  it('should handle very high income (top bracket, 45%)', () => {
    const result = calculateIncomeTax(100_000_000) // 1.2B annually
    expect(result.incomeTax).toBeGreaterThan(0)
    expect(result.total).toBeGreaterThan(result.incomeTax) // local tax adds
  })

  // Earned income deduction tier seam tests
  it('should apply correct deduction for annual gross <= 5M', () => {
    // Monthly ~416,667 → annual ~5M, deduction = 70%
    const resultA = calculateIncomeTax(416_666)
    const resultB = calculateIncomeTax(416_667)
    // Both should be very low or zero (large deduction relative to income)
    expect(resultA.incomeTax).toBeGreaterThanOrEqual(0)
    expect(resultB.incomeTax).toBeGreaterThanOrEqual(0)
  })

  it('should apply correct deduction for annual gross crossing 15M tier', () => {
    const resultBelow = calculateIncomeTax(1_249_999)
    const resultAbove = calculateIncomeTax(1_250_001)
    expect(resultAbove.incomeTax).toBeGreaterThanOrEqual(resultBelow.incomeTax)
  })

  it('should apply correct deduction for annual gross crossing 45M tier', () => {
    const resultBelow = calculateIncomeTax(3_749_999)
    const resultAbove = calculateIncomeTax(3_750_001)
    expect(resultAbove.incomeTax).toBeGreaterThanOrEqual(resultBelow.incomeTax)
  })

  it('should produce positive tax for median salary (3M/month)', () => {
    const result = calculateIncomeTax(3_000_000)
    expect(result.incomeTax).toBeGreaterThan(0)
    expect(result.localIncomeTax).toBeGreaterThan(0)
  })

  it('should monotonically increase tax with higher income', () => {
    const salaries = [1_000_000, 2_000_000, 3_000_000, 5_000_000, 10_000_000]
    const taxes = salaries.map(s => calculateIncomeTax(s).total)
    for (let i = 1; i < taxes.length; i++) {
      expect(taxes[i]).toBeGreaterThanOrEqual(taxes[i - 1])
    }
  })
})

// ─── calculateTotalDeductions ───────────────────────────────

describe('calculateTotalDeductions', () => {
  it('should combine social insurance and income tax', () => {
    const result = calculateTotalDeductions(3_000_000)
    const social = calculateSocialInsurance(3_000_000)
    const income = calculateIncomeTax(3_000_000)
    expect(result.socialInsurance).toEqual(social)
    expect(result.incomeTax).toEqual(income)
    expect(result.totalDeductions).toBe(social.total + income.total)
  })

  it('should return zeros for zero gross', () => {
    const result = calculateTotalDeductions(0)
    expect(result.totalDeductions).toBe(0)
  })

  it('should have totalDeductions equal sum of sub-totals', () => {
    const result = calculateTotalDeductions(5_000_000)
    expect(result.totalDeductions).toBe(result.socialInsurance.total + result.incomeTax.total)
  })
})

// ─── separateTaxableIncome ──────────────────────────────────

describe('separateTaxableIncome', () => {
  const baseSalary = 3_000_000
  const overtimePay = 500_000

  it('should treat meal allowance below limit as fully nontaxable', () => {
    const allowances: AllowanceItem[] = [
      { code: 'meal_allowance', name: '식대', amount: 150_000, isTaxable: false },
    ]
    const result = separateTaxableIncome(baseSalary, overtimePay, allowances, {})
    expect(result.nontaxableTotal).toBe(150_000)
    expect(result.taxableIncome).toBe(baseSalary + overtimePay)
  })

  it('should split meal allowance above limit into taxable overflow', () => {
    const allowances: AllowanceItem[] = [
      { code: 'meal_allowance', name: '식대', amount: 300_000, isTaxable: false },
    ]
    const result = separateTaxableIncome(baseSalary, overtimePay, allowances, {})
    // Default limit: 200,000. Nontaxable: 200,000, overflow: 100,000
    expect(result.nontaxableTotal).toBe(200_000)
    expect(result.taxableIncome).toBe(baseSalary + overtimePay + 100_000)
  })

  it('should send fully taxable items to taxableIncome', () => {
    const allowances: AllowanceItem[] = [
      { code: 'bonus', name: '성과급', amount: 1_000_000, isTaxable: true },
    ]
    const result = separateTaxableIncome(baseSalary, overtimePay, allowances, {})
    expect(result.nontaxableTotal).toBe(0)
    expect(result.taxableIncome).toBe(baseSalary + overtimePay + 1_000_000)
  })

  it('should use explicit nontaxableLimits over defaults', () => {
    const allowances: AllowanceItem[] = [
      { code: 'meal_allowance', name: '식대', amount: 300_000, isTaxable: false },
    ]
    const result = separateTaxableIncome(baseSalary, overtimePay, allowances, { meal_allowance: 300_000 })
    expect(result.nontaxableTotal).toBe(300_000) // Custom limit allows full amount
    expect(result.taxableIncome).toBe(baseSalary + overtimePay)
  })

  it('should handle mixed taxable and nontaxable allowances', () => {
    const allowances: AllowanceItem[] = [
      { code: 'meal_allowance', name: '식대', amount: 200_000, isTaxable: false },
      { code: 'bonus', name: '성과급', amount: 500_000, isTaxable: true },
    ]
    const result = separateTaxableIncome(baseSalary, overtimePay, allowances, {})
    expect(result.nontaxableTotal).toBe(200_000)
    expect(result.taxableIncome).toBe(baseSalary + overtimePay + 500_000)
  })

  it('should handle unknown nontaxable code with zero default', () => {
    const allowances: AllowanceItem[] = [
      { code: 'unknown_benefit', name: '기타', amount: 100_000, isTaxable: false },
    ]
    const result = separateTaxableIncome(baseSalary, overtimePay, allowances, {})
    // No default for unknown code → limit 0 → all becomes taxable overflow
    expect(result.nontaxableTotal).toBe(0)
    expect(result.taxableIncome).toBe(baseSalary + overtimePay + 100_000)
  })

  it('should handle zero-amount allowances', () => {
    const allowances: AllowanceItem[] = [
      { code: 'meal_allowance', name: '식대', amount: 0, isTaxable: false },
    ]
    const result = separateTaxableIncome(baseSalary, overtimePay, allowances, {})
    expect(result.nontaxableTotal).toBe(0)
    expect(result.taxableIncome).toBe(baseSalary + overtimePay)
  })

  it('should handle empty allowances array', () => {
    const result = separateTaxableIncome(baseSalary, overtimePay, [], {})
    expect(result.nontaxableTotal).toBe(0)
    expect(result.taxableIncome).toBe(baseSalary + overtimePay)
    expect(result.nontaxableDetail).toEqual([])
  })

  it('should populate nontaxableDetail with code, name, amount, limit', () => {
    const allowances: AllowanceItem[] = [
      { code: 'meal_allowance', name: '식대', amount: 200_000, isTaxable: false },
    ]
    const result = separateTaxableIncome(baseSalary, overtimePay, allowances, {})
    expect(result.nontaxableDetail).toHaveLength(1)
    expect(result.nontaxableDetail[0]).toEqual({
      code: 'meal_allowance',
      name: '식대',
      amount: 200_000,
      limit: 200_000,
    })
  })

  it('should handle exact-limit amount (no overflow)', () => {
    const allowances: AllowanceItem[] = [
      { code: 'vehicle_allowance', name: '차량유지비', amount: 200_000, isTaxable: false },
    ]
    const result = separateTaxableIncome(baseSalary, overtimePay, allowances, {})
    expect(result.nontaxableTotal).toBe(200_000)
    expect(result.taxableIncome).toBe(baseSalary + overtimePay) // no overflow
  })
})

// ─── getWeekdaysInMonth ─────────────────────────────────────

describe('getWeekdaysInMonth', () => {
  it('should return 22 weekdays for January 2026', () => {
    // Jan 2026: Thu Jan 1 → Sat Jan 31, 22 weekdays
    expect(getWeekdaysInMonth(2026, 1)).toBe(22)
  })

  it('should return 20 weekdays for February 2026', () => {
    // Feb 2026: 28 days, 20 weekdays
    expect(getWeekdaysInMonth(2026, 2)).toBe(20)
  })

  it('should handle 31-day month (March 2026)', () => {
    expect(getWeekdaysInMonth(2026, 3)).toBe(22)
  })

  it('should handle February in leap year (2028)', () => {
    // Feb 2028: 29 days
    expect(getWeekdaysInMonth(2028, 2)).toBe(21)
  })

  it('should return correct count for April 2026 (30 days)', () => {
    expect(getWeekdaysInMonth(2026, 4)).toBe(22)
  })
})

// ─── getWeekdaysBetween ─────────────────────────────────────

describe('getWeekdaysBetween', () => {
  it('should return 5 for Mon-Fri range', () => {
    // 2026-01-05 (Mon) to 2026-01-09 (Fri)
    const start = new Date(Date.UTC(2026, 0, 5))
    const end = new Date(Date.UTC(2026, 0, 9))
    expect(getWeekdaysBetween(start, end)).toBe(5)
  })

  it('should return 5 for Mon-Sun range (weekends excluded)', () => {
    // 2026-01-05 (Mon) to 2026-01-11 (Sun)
    const start = new Date(Date.UTC(2026, 0, 5))
    const end = new Date(Date.UTC(2026, 0, 11))
    expect(getWeekdaysBetween(start, end)).toBe(5)
  })

  it('should return 0 for a Saturday', () => {
    // 2026-01-10 (Sat)
    const sat = new Date(Date.UTC(2026, 0, 10))
    expect(getWeekdaysBetween(sat, sat)).toBe(0)
  })

  it('should return 1 for a single weekday', () => {
    // 2026-01-05 (Mon)
    const mon = new Date(Date.UTC(2026, 0, 5))
    expect(getWeekdaysBetween(mon, mon)).toBe(1)
  })
})

// ─── calculateProrated ─────────────────────────────────────

describe('calculateProrated', () => {
  const monthlyAmount = 3_000_000

  it('should return full amount when no hire/resign date (full month)', () => {
    const result = calculateProrated(monthlyAmount, 2026, 1)
    expect(result.isProrated).toBe(false)
    expect(result.ratio).toBe(1)
    expect(result.proratedAmount).toBe(monthlyAmount)
  })

  it('should prorate for mid-month hire (Jan 15)', () => {
    const hireDate = new Date(Date.UTC(2026, 0, 15))
    const result = calculateProrated(monthlyAmount, 2026, 1, hireDate)
    expect(result.isProrated).toBe(true)
    expect(result.ratio).toBeLessThan(1)
    expect(result.proratedAmount).toBeLessThan(monthlyAmount)
    expect(result.workDays).toBeLessThan(result.totalDays)
  })

  it('should prorate for mid-month resignation (Jan 15)', () => {
    const resignDate = new Date(Date.UTC(2026, 0, 15))
    const result = calculateProrated(monthlyAmount, 2026, 1, undefined, resignDate)
    expect(result.isProrated).toBe(true)
    expect(result.ratio).toBeLessThan(1)
  })

  it('should not prorate when hired on first day of month', () => {
    const hireDate = new Date(Date.UTC(2026, 0, 1))
    const result = calculateProrated(monthlyAmount, 2026, 1, hireDate)
    expect(result.isProrated).toBe(false)
    expect(result.ratio).toBe(1)
  })

  it('should not prorate when resigned on last day of month', () => {
    const resignDate = new Date(Date.UTC(2026, 0, 31))
    const result = calculateProrated(monthlyAmount, 2026, 1, undefined, resignDate)
    expect(result.isProrated).toBe(false)
    expect(result.ratio).toBe(1)
  })
})

// ─── detectPayrollAnomalies ─────────────────────────────────

describe('detectPayrollAnomalies', () => {
  it('should return no anomalies when within thresholds', () => {
    const current = { grossPay: 3_000_000, overtimePay: 100_000, baseSalary: 3_000_000, isProrated: false }
    const previous = { grossPay: 2_900_000 }
    const result = detectPayrollAnomalies(current, previous)
    expect(result).toHaveLength(0)
  })

  it('should detect gross change > 20%', () => {
    const current = { grossPay: 4_000_000, overtimePay: 0, baseSalary: 3_000_000, isProrated: false }
    const previous = { grossPay: 3_000_000 } // 33% change
    const result = detectPayrollAnomalies(current, previous)
    expect(result.some(a => a.code === 'GROSS_CHANGE_OVER_THRESHOLD')).toBe(true)
  })

  it('should detect overtime > 50% of base', () => {
    const current = { grossPay: 5_000_000, overtimePay: 2_000_000, baseSalary: 3_000_000, isProrated: false }
    const result = detectPayrollAnomalies(current, null)
    expect(result.some(a => a.code === 'OVERTIME_OVER_THRESHOLD')).toBe(true)
  })

  it('should add INFO for prorated pay', () => {
    const current = { grossPay: 1_500_000, overtimePay: 0, baseSalary: 1_500_000, isProrated: true }
    const result = detectPayrollAnomalies(current, null)
    expect(result.some(a => a.code === 'PRORATED' && a.type === 'INFO')).toBe(true)
  })

  it('should detect multiple anomalies simultaneously', () => {
    const current = { grossPay: 5_000_000, overtimePay: 2_000_000, baseSalary: 3_000_000, isProrated: true }
    const previous = { grossPay: 3_000_000 }
    const result = detectPayrollAnomalies(current, previous)
    expect(result.length).toBeGreaterThanOrEqual(2) // gross change + overtime + prorated
  })

  it('should not detect gross change when no previous month', () => {
    const current = { grossPay: 3_000_000, overtimePay: 0, baseSalary: 3_000_000, isProrated: false }
    const result = detectPayrollAnomalies(current, null)
    expect(result.some(a => a.code === 'GROSS_CHANGE_OVER_THRESHOLD')).toBe(false)
  })

  // Codex #3: strict > boundary tests
  it('should NOT trigger at exact 20% gross change (strict >)', () => {
    const current = { grossPay: 3_600_000, overtimePay: 0, baseSalary: 3_600_000, isProrated: false }
    const previous = { grossPay: 3_000_000 } // exactly 20%
    const result = detectPayrollAnomalies(current, previous)
    expect(result.some(a => a.code === 'GROSS_CHANGE_OVER_THRESHOLD')).toBe(false)
  })

  it('should suppress gross change detection when previous.grossPay = 0', () => {
    const current = { grossPay: 3_000_000, overtimePay: 0, baseSalary: 3_000_000, isProrated: false }
    const previous = { grossPay: 0 }
    const result = detectPayrollAnomalies(current, previous)
    expect(result.some(a => a.code === 'GROSS_CHANGE_OVER_THRESHOLD')).toBe(false)
  })

  it('should suppress overtime check when baseSalary = 0', () => {
    const current = { grossPay: 1_000_000, overtimePay: 500_000, baseSalary: 0, isProrated: false }
    const result = detectPayrollAnomalies(current, null)
    expect(result.some(a => a.code === 'OVERTIME_OVER_THRESHOLD')).toBe(false)
  })
})
