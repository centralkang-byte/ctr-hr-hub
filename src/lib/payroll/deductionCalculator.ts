// Per-item deductible amount calculation with limit enforcement
// Reads limits/rates from YearEndDeductionConfig.rules JSON

import { prisma } from '@/lib/prisma'

interface DeductionRules {
  rate?: number
  thresholdRate?: number
  rates?: Record<string, number>
  limits?: Record<string, number>
  additionalLimits?: Record<string, number>
  annualLimit?: number
  salaryLimit?: number
  basePerPerson?: number
  additionalSenior?: number
  additionalDisabled?: number
  additionalSingleParent?: number
  brackets?: Array<{ maxTax?: number; minTax?: number; rate: number; base?: number }>
  first?: number
  second?: number
  thirdPlus?: number
  [key: string]: unknown
}

/**
 * Calculate deductible amount for a given deduction code.
 * Returns the amount after limit enforcement.
 *
 * @param code - config code (e.g. 'credit_card', 'medical_credit')
 * @param inputAmount - raw amount entered by employee (KRW)
 * @param totalSalary - annual gross salary (KRW)
 * @param year - tax year
 * @param details - optional per-item breakdown (e.g. credit card type split)
 */
export async function calculateDeductibleAmount(
  code: string,
  inputAmount: number,
  totalSalary: number,
  year: number,
  details?: Record<string, number>,
): Promise<number> {
  const config = await prisma.yearEndDeductionConfig.findUnique({
    where: { year_code: { year, code } },
  })
  if (!config) return 0

  const rules = config.rules as DeductionRules

  switch (code) {
    case 'national_pension':
    case 'health_insurance':
      // 전액 공제
      return Math.round(inputAmount * (rules.rate ?? 1.0))

    case 'credit_card': {
      // 총급여 25% 초과분 × 유형별 공제율, 한도 적용
      const threshold = Math.round(totalSalary * (rules.thresholdRate ?? 0.25))
      if (inputAmount <= threshold) return 0
      const excess = inputAmount - threshold

      // details가 있으면 유형별 공제율 적용, 없으면 신용카드 기본 15% 적용
      let calculated = 0
      if (details && rules.rates) {
        for (const [type, amount] of Object.entries(details)) {
          const rate = rules.rates[type] ?? 0.15
          calculated += Math.round(Math.min(amount, excess) * rate)
        }
      } else {
        calculated = Math.round(excess * (rules.rates?.credit_card ?? 0.15))
      }

      // 한도 결정
      const limit = totalSalary < 70_000_000
        ? (rules.limits?.salary_under_7000 ?? 3_000_000)
        : totalSalary < 120_000_000
          ? (rules.limits?.salary_7000_12000 ?? 2_500_000)
          : (rules.limits?.salary_over_12000 ?? 2_000_000)

      return Math.min(calculated, limit)
    }

    case 'medical_credit': {
      // 총급여 3% 초과분 × 15%, 한도 700만
      const threshold = Math.round(totalSalary * (rules.thresholdRate ?? 0.03))
      if (inputAmount <= threshold) return 0
      const excess = inputAmount - threshold
      const calculated = Math.round(excess * (rules.rate ?? 0.15))
      const limit = (rules.limit as number | undefined) ?? 7_000_000
      return Math.min(calculated, limit)
    }

    case 'education_credit': {
      // 교육비 × 15%, 자녀 1인당 300만 한도 (본인은 한도 없음)
      const rate = rules.rate ?? 0.15
      const childLimit = (rules.childLimit as number | undefined) ?? 3_000_000
      // details.self (본인), details.child (자녀, 한도 적용)
      if (details) {
        const selfAmount = (details.self ?? 0) * rate
        const childAmount = Math.min(details.child ?? 0, childLimit) * rate
        return Math.round(selfAmount + childAmount)
      }
      return Math.round(inputAmount * rate)
    }

    case 'donation_credit': {
      // 정치자금 10만 이하: 100/110 세액공제, 초과분 15% or 30%
      // Simplified: 15% base rate
      const calculated = Math.round(inputAmount * ((rules.rate15 as number | undefined) ?? 0.15))
      return calculated
    }

    case 'rent_credit': {
      // 월세 세액공제: 총급여 7000만 이하, 연한도 750만, 세율 17% (5500만 이하) or 15%
      const salaryLimit = (rules.salaryLimit as number | undefined) ?? 70_000_000
      if (totalSalary > salaryLimit) return 0
      const annualLimit = (rules.annualLimit as number | undefined) ?? 7_500_000
      const cappedAmount = Math.min(inputAmount, annualLimit)
      const rate = totalSalary <= 55_000_000
        ? ((rules.rate_under_5500 as number | undefined) ?? 0.17)
        : ((rules.rate_5500_7000 as number | undefined) ?? 0.15)
      return Math.round(cappedAmount * rate)
    }

    case 'housing_savings': {
      // 주택마련저축: 40%, 연한도 240만, 총급여 7000만 이하
      const salaryLimit = (rules.salaryLimit as number | undefined) ?? 70_000_000
      if (totalSalary > salaryLimit) return 0
      const annualLimit = (rules.annualLimit as number | undefined) ?? 2_400_000
      return Math.round(Math.min(inputAmount, annualLimit) * (rules.rate ?? 0.4))
    }

    case 'housing_loan_interest': {
      // 주택임차차입금: 유형별 한도 적용
      const limit = details?.type === 15
        ? (rules.limits?.mortgage_fixed_15y ?? 15_000_000)
        : details?.type === 10
          ? (rules.limits?.mortgage_fixed_10y ?? 3_000_000)
          : (rules.limits?.lease_deposit ?? 3_000_000)
      return Math.min(inputAmount, limit)
    }

    // earned_income_credit and child_credit are calculated during main calculation, not from user input
    default:
      return inputAmount
  }
}

/**
 * Calculate earned income tax credit (근로소득 세액공제)
 * Applied to calculatedTax, limited by total salary bracket
 */
export function calculateEarnedIncomeCredit(
  calculatedTax: number,
  totalSalary: number,
  rules: DeductionRules,
): number {
  const brackets = rules.brackets ?? [
    { maxTax: 1_300_000, rate: 0.55 },
    { minTax: 1_300_000, rate: 0.30, base: 715_000 },
  ]

  let credit: number
  const firstBracket = brackets[0]
  const secondBracket = brackets[1]

  if (calculatedTax <= (firstBracket.maxTax ?? 1_300_000)) {
    credit = Math.round(calculatedTax * firstBracket.rate)
  } else {
    credit = Math.round((secondBracket.base ?? 715_000) +
      (calculatedTax - (secondBracket.minTax ?? 1_300_000)) * secondBracket.rate)
  }

  // 한도: 총급여 기준
  const limits = rules.limits as { salary_under_3300: number; salary_3300_7000: number; salary_over_7000: number } | undefined
  const limit = totalSalary <= 33_000_000
    ? (limits?.salary_under_3300 ?? 740_000)
    : totalSalary <= 70_000_000
      ? (limits?.salary_3300_7000 ?? 660_000)
      : (limits?.salary_over_7000 ?? 500_000)

  return Math.min(credit, limit)
}

/**
 * Calculate child tax credit (자녀 세액공제)
 */
export function calculateChildCredit(
  childCount: number,
  rules: DeductionRules,
): number {
  if (childCount <= 0) return 0
  if (childCount === 1) return rules.first ?? 150_000
  if (childCount === 2) return rules.second ?? 350_000
  return (rules.second ?? 350_000) + (childCount - 2) * (rules.thirdPlus ?? 300_000)
}
