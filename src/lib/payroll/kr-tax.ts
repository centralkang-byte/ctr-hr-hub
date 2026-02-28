// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Korean Tax & Social Insurance Rates (2025)
// 4대보험 + 소득세 계산
// ═══════════════════════════════════════════════════════════

// ─── 4대보험 요율 (근로자 부담분) ──────────────────────────

/** 국민연금: 4.5% (월 상한 590만원) */
export const NATIONAL_PENSION_RATE = 0.045
export const NATIONAL_PENSION_CEILING = 5_900_000

/** 건강보험: 3.545% */
export const HEALTH_INSURANCE_RATE = 0.03545

/** 장기요양보험: 건강보험의 12.81% */
export const LONG_TERM_CARE_RATE = 0.1281

/** 고용보험: 0.9% */
export const EMPLOYMENT_INSURANCE_RATE = 0.009

// ─── 통상시급 ──────────────────────────────────────────────

/** 월 소정근로시간 = 209시간 (주 40시간 기준) */
export const MONTHLY_STANDARD_HOURS = 209

export function calculateHourlyWage(monthlySalary: number): number {
  return Math.round(monthlySalary / MONTHLY_STANDARD_HOURS)
}

// ─── 4대보험 공제 계산 ─────────────────────────────────────

export interface SocialInsuranceResult {
  nationalPension: number
  healthInsurance: number
  longTermCare: number
  employmentInsurance: number
  total: number
}

export function calculateSocialInsurance(
  monthlyGross: number,
): SocialInsuranceResult {
  // 국민연금: 상한 적용
  const pensionBase = Math.min(monthlyGross, NATIONAL_PENSION_CEILING)
  const nationalPension = Math.round(pensionBase * NATIONAL_PENSION_RATE)

  // 건강보험
  const healthInsurance = Math.round(monthlyGross * HEALTH_INSURANCE_RATE)

  // 장기요양보험: 건강보험료의 12.81%
  const longTermCare = Math.round(healthInsurance * LONG_TERM_CARE_RATE)

  // 고용보험
  const employmentInsurance = Math.round(monthlyGross * EMPLOYMENT_INSURANCE_RATE)

  return {
    nationalPension,
    healthInsurance,
    longTermCare,
    employmentInsurance,
    total: nationalPension + healthInsurance + longTermCare + employmentInsurance,
  }
}

// ─── 소득세 (근로소득 간이세액표 간소화) ────────────────────

interface TaxBracket {
  min: number
  max: number
  rate: number
  deduction: number
}

/**
 * 2025년 종합소득세 세율표 (8구간)
 * 연간 과세표준 기준
 */
const TAX_BRACKETS: TaxBracket[] = [
  { min: 0, max: 14_000_000, rate: 0.06, deduction: 0 },
  { min: 14_000_000, max: 50_000_000, rate: 0.15, deduction: 1_260_000 },
  { min: 50_000_000, max: 88_000_000, rate: 0.24, deduction: 5_760_000 },
  { min: 88_000_000, max: 150_000_000, rate: 0.35, deduction: 15_440_000 },
  { min: 150_000_000, max: 300_000_000, rate: 0.38, deduction: 19_940_000 },
  { min: 300_000_000, max: 500_000_000, rate: 0.40, deduction: 25_940_000 },
  { min: 500_000_000, max: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
  { min: 1_000_000_000, max: Infinity, rate: 0.45, deduction: 65_940_000 },
]

/** 근로소득공제 (연간 총급여 기준) */
function earnedIncomeDeduction(annualGross: number): number {
  if (annualGross <= 5_000_000) return annualGross * 0.70
  if (annualGross <= 15_000_000) return 3_500_000 + (annualGross - 5_000_000) * 0.40
  if (annualGross <= 45_000_000) return 7_500_000 + (annualGross - 15_000_000) * 0.15
  if (annualGross <= 100_000_000) return 12_000_000 + (annualGross - 45_000_000) * 0.05
  return 14_750_000 + (annualGross - 100_000_000) * 0.02
}

export interface IncomeTaxResult {
  incomeTax: number
  localIncomeTax: number
  total: number
}

/**
 * 월 소득세 계산 (간이세액표 간소화 버전)
 * 연간 과세표준 추정 → 누진세율 → 12등분
 */
export function calculateIncomeTax(monthlyGross: number): IncomeTaxResult {
  const annualGross = monthlyGross * 12

  // 근로소득공제
  const deduction = earnedIncomeDeduction(annualGross)
  const taxableIncome = Math.max(0, annualGross - deduction)

  // 누진세율 적용
  let annualTax = 0
  for (const bracket of TAX_BRACKETS) {
    if (taxableIncome > bracket.min) {
      annualTax = taxableIncome * bracket.rate - bracket.deduction
    } else {
      break
    }
  }

  // 월 환산 (원 미만 절사)
  const monthlyIncomeTax = Math.max(0, Math.floor(annualTax / 12))

  // 지방소득세: 소득세의 10%
  const localIncomeTax = Math.floor(monthlyIncomeTax * 0.1)

  return {
    incomeTax: monthlyIncomeTax,
    localIncomeTax,
    total: monthlyIncomeTax + localIncomeTax,
  }
}

// ─── 전체 공제 합산 ────────────────────────────────────────

export interface TotalDeductionResult {
  socialInsurance: SocialInsuranceResult
  incomeTax: IncomeTaxResult
  totalDeductions: number
}

export function calculateTotalDeductions(
  monthlyGross: number,
): TotalDeductionResult {
  const socialInsurance = calculateSocialInsurance(monthlyGross)
  const incomeTax = calculateIncomeTax(monthlyGross)

  return {
    socialInsurance,
    incomeTax,
    totalDeductions: socialInsurance.total + incomeTax.total,
  }
}
