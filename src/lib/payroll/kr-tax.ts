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

// ─── B7-1a: 비과세 분리 ────────────────────────────────────

// FIX: Issue #3 — Statutory non-taxable defaults (2025 기준 법정 한도)
// DB에 NontaxableLimit 레코드가 없을 때 사용하는 fallback 값.
// 항목 코드는 calculator.ts의 AllowanceItem.code와 일치해야 함.
const STATUTORY_NON_TAXABLE_DEFAULTS: Record<string, number> = {
  meal_allowance:    200_000,  // 식대 비과세 한도 (소득세법 §12 ②)
  vehicle_allowance: 200_000,  // 자가운전보조금 (소득세법 §12 ②)
  childcare:         100_000,  // 보육수당
  MEAL:              200_000,  // BenefitPolicy.category 코드 대응
  VEHICLE:           200_000,
  CHILDCARE:         100_000,
}


export interface AllowanceItem {
  code: string
  name: string
  amount: number
  isTaxable: boolean
}

export interface NontaxableSeparationResult {
  taxableIncome: number
  nontaxableTotal: number
  nontaxableDetail: Array<{ code: string; name: string; amount: number; limit: number }>
}

/**
 * 식대/차량 등 비과세 한도 적용 후 과세/비과세 분리
 * limits: { code → monthlyLimit } 맵
 */
export function separateTaxableIncome(
  baseSalary: number,
  overtimePay: number,
  allowances: AllowanceItem[],
  nontaxableLimits: Record<string, number>,
): NontaxableSeparationResult {
  let nontaxableTotal = 0
  const nontaxableDetail: NontaxableSeparationResult['nontaxableDetail'] = []
  let taxableAllowances = 0

  for (const item of allowances) {
    if (!item.isTaxable) {
      // FIX: Issue #3 — Non-taxable limit returns 0 when config missing.
      //   Use statutory defaults (2025 기준) instead of silently defaulting to 0.
      //   This prevents entire allowance from becoming taxable due to missing config.
      const configuredLimit = nontaxableLimits[item.code]
      const limit = configuredLimit !== undefined
        ? configuredLimit
        : STATUTORY_NON_TAXABLE_DEFAULTS[item.code] ?? 0

      if (configuredLimit === undefined && item.amount > 0) {
        console.warn(
          `[Payroll] Non-taxable limit not configured for '${item.code}' (${item.name}). ` +
          `Using statutory default: ${limit.toLocaleString()}원. ` +
          `Please configure NontaxableLimit record to remove this warning.`,
        )
      }

      const nontaxableAmount = Math.min(item.amount, limit)
      const taxableOverflow = item.amount - nontaxableAmount
      nontaxableTotal += nontaxableAmount
      taxableAllowances += taxableOverflow
      if (nontaxableAmount > 0) {
        nontaxableDetail.push({ code: item.code, name: item.name, amount: nontaxableAmount, limit })
      }
    } else {
      taxableAllowances += item.amount
    }

  }

  const taxableIncome = baseSalary + overtimePay + taxableAllowances

  return { taxableIncome, nontaxableTotal, nontaxableDetail }
}

// ─── B7-1a: 일할계산 ──────────────────────────────────────

/**
 * 주어진 연월의 평일(근무일) 수 계산
 * 토/일을 제외한 단순 평일 기준 (공휴일 미반영)
 * UTC 기반 Date 연산으로 서버 로컬 타임존 영향 제거
 */
export function getWeekdaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  let weekdays = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay()
    if (dow !== 0 && dow !== 6) weekdays++
  }
  return weekdays
}

/**
 * 두 날짜 사이(포함)의 평일 수 계산
 * UTC 기반으로 요일 판정 — parseDateOnly / Date.UTC 기반 날짜와 안전하게 비교됨
 */
export function getWeekdaysBetween(start: Date, end: Date): number {
  let count = 0
  const cur = new Date(start)
  cur.setUTCHours(0, 0, 0, 0)
  const endD = new Date(end)
  endD.setUTCHours(0, 0, 0, 0)
  while (cur <= endD) {
    const dow = cur.getUTCDay()
    if (dow !== 0 && dow !== 6) count++
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return count
}

export interface ProrateResult {
  proratedAmount: number
  ratio: number
  workDays: number
  totalDays: number
  isProrated: boolean
}

/**
 * 중도입사/퇴사 일할계산
 * hireDate: 입사일 (당월 이후면 일할), undefined면 일할 불필요
 * resignDate: 퇴사일 (당월 이전이면 일할), undefined면 일할 불필요
 */
export function calculateProrated(
  monthlyAmount: number,
  year: number,
  month: number,
  hireDate?: Date,
  resignDate?: Date,
): ProrateResult {
  // UTC 기반으로 월 경계 생성 — parseDateOnly / Date.UTC 기반 날짜와 정확히 비교됨
  const monthStart = new Date(Date.UTC(year, month - 1, 1))
  const monthEnd = new Date(Date.UTC(year, month, 0)) // 말일

  const effectiveStart = hireDate && hireDate > monthStart ? hireDate : monthStart
  const effectiveEnd = resignDate && resignDate < monthEnd ? resignDate : monthEnd

  if (effectiveStart <= monthStart && effectiveEnd >= monthEnd) {
    // 일할 불필요
    const totalDays = getWeekdaysInMonth(year, month)
    return { proratedAmount: monthlyAmount, ratio: 1, workDays: totalDays, totalDays, isProrated: false }
  }

  const totalDays = getWeekdaysInMonth(year, month)
  const workDays = getWeekdaysBetween(effectiveStart, effectiveEnd)
  const ratio = totalDays > 0 ? workDays / totalDays : 0
  const proratedAmount = Math.round(monthlyAmount * ratio)

  return { proratedAmount, ratio, workDays, totalDays, isProrated: true }
}

// ─── B7-1a: 이상 항목 감지 ────────────────────────────────

export interface PayrollAnomalyCheck {
  type: 'WARNING' | 'INFO'
  code: string
  message: string
}

export function detectPayrollAnomalies(
  current: { grossPay: number; overtimePay: number; baseSalary: number; isProrated: boolean },
  previous: { grossPay: number } | null,
): PayrollAnomalyCheck[] {
  const anomalies: PayrollAnomalyCheck[] = []

  // 전월 대비 변동 > 20%
  if (previous && previous.grossPay > 0) {
    const changeRatio = Math.abs(current.grossPay - previous.grossPay) / previous.grossPay
    if (changeRatio > 0.2) {
      anomalies.push({
        type: 'WARNING',
        code: 'GROSS_CHANGE_OVER_20PCT',
        message: `총지급액이 전월 대비 ${Math.round(changeRatio * 100)}% 변동`,
      })
    }
  }

  // 초과근무수당 > 기본급 50%
  if (current.baseSalary > 0 && current.overtimePay > current.baseSalary * 0.5) {
    anomalies.push({
      type: 'WARNING',
      code: 'OVERTIME_OVER_50PCT_BASE',
      message: `초과근무수당(${current.overtimePay.toLocaleString()}원)이 기본급의 50%를 초과`,
    })
  }

  // 중도입사/퇴사 일할계산 정보
  if (current.isProrated) {
    anomalies.push({ type: 'INFO', code: 'PRORATED', message: '중도입사/퇴사 일할계산 적용' })
  }

  return anomalies
}
