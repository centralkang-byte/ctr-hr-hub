// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Korean Tax & Social Insurance Rates (2025)
// 4대보험 + 소득세 계산
//
// Refactored (H-2c): hardcoded constants preserved as DEFAULTS,
// async variants added that fetch from CompanyProcessSetting.
// ═══════════════════════════════════════════════════════════

import { getPayrollSetting } from '@/lib/settings/get-setting'

// ─── 4대보험 DEFAULT 요율 (근로자 부담분, fallback) ──────────

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

// ─── 4대보험 Settings 인터페이스 ────────────────────────────

interface KrSocialInsuranceSettings {
  pensionRate: number
  pensionCeiling: number
  healthRate: number
  longTermCareRate: number
  employmentRate: number
}

// ─── 4대보험 공제 계산 ─────────────────────────────────────

export interface SocialInsuranceResult {
  nationalPension: number
  healthInsurance: number
  longTermCare: number
  employmentInsurance: number
  total: number
}

/**
 * Synchronous version using hardcoded defaults (backward-compatible)
 */
export function calculateSocialInsurance(
  monthlyGross: number,
): SocialInsuranceResult {
  const pensionBase = Math.min(monthlyGross, NATIONAL_PENSION_CEILING)
  const nationalPension = Math.round(pensionBase * NATIONAL_PENSION_RATE)
  const healthInsurance = Math.round(monthlyGross * HEALTH_INSURANCE_RATE)
  const longTermCare = Math.round(healthInsurance * LONG_TERM_CARE_RATE)
  const employmentInsurance = Math.round(monthlyGross * EMPLOYMENT_INSURANCE_RATE)

  return {
    nationalPension,
    healthInsurance,
    longTermCare,
    employmentInsurance,
    total: nationalPension + healthInsurance + longTermCare + employmentInsurance,
  }
}

/**
 * Async version that reads rates from Settings API.
 * Falls back to hardcoded DEFAULTS if settings not configured.
 * Uses ?? (nullish coalescing) — never || (zero is valid).
 */
export async function calculateSocialInsuranceFromSettings(
  monthlyGross: number,
  companyId?: string | null,
): Promise<SocialInsuranceResult> {
  const settings = await getPayrollSetting<KrSocialInsuranceSettings>(
    'kr-social-insurance',
    companyId,
  )

  const pensionRate = settings?.pensionRate ?? NATIONAL_PENSION_RATE
  const pensionCeiling = settings?.pensionCeiling ?? NATIONAL_PENSION_CEILING
  const healthRate = settings?.healthRate ?? HEALTH_INSURANCE_RATE
  const longTermCareRate = settings?.longTermCareRate ?? LONG_TERM_CARE_RATE
  const employmentRate = settings?.employmentRate ?? EMPLOYMENT_INSURANCE_RATE

  const pensionBase = Math.min(monthlyGross, pensionCeiling)
  const nationalPension = Math.round(pensionBase * pensionRate)
  const healthInsurance = Math.round(monthlyGross * healthRate)
  const longTermCare = Math.round(healthInsurance * longTermCareRate)
  const employmentInsurance = Math.round(monthlyGross * employmentRate)

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
  max: number | null
  rate: number
  deduction: number
}

/**
 * 2025년 종합소득세 세율표 (8구간) — DEFAULT
 */
const DEFAULT_TAX_BRACKETS: TaxBracket[] = [
  { min: 0, max: 14_000_000, rate: 0.06, deduction: 0 },
  { min: 14_000_000, max: 50_000_000, rate: 0.15, deduction: 1_260_000 },
  { min: 50_000_000, max: 88_000_000, rate: 0.24, deduction: 5_760_000 },
  { min: 88_000_000, max: 150_000_000, rate: 0.35, deduction: 15_440_000 },
  { min: 150_000_000, max: 300_000_000, rate: 0.38, deduction: 19_940_000 },
  { min: 300_000_000, max: 500_000_000, rate: 0.40, deduction: 25_940_000 },
  { min: 500_000_000, max: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
  { min: 1_000_000_000, max: null, rate: 0.45, deduction: 65_940_000 },
]

const DEFAULT_LOCAL_INCOME_TAX_RATE = 0.10

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

/** Internal: computes income tax from brackets (shared by sync + async) */
function computeIncomeTax(
  monthlyGross: number,
  brackets: TaxBracket[],
  localTaxRate: number,
): IncomeTaxResult {
  const annualGross = monthlyGross * 12
  const deduction = earnedIncomeDeduction(annualGross)
  const taxableIncome = Math.max(0, annualGross - deduction)

  let annualTax = 0
  for (const bracket of brackets) {
    if (taxableIncome > bracket.min) {
      annualTax = taxableIncome * bracket.rate - bracket.deduction
    } else {
      break
    }
  }

  const monthlyIncomeTax = Math.max(0, Math.floor(annualTax / 12))
  const localIncomeTax = Math.floor(monthlyIncomeTax * localTaxRate)

  return {
    incomeTax: monthlyIncomeTax,
    localIncomeTax,
    total: monthlyIncomeTax + localIncomeTax,
  }
}

/**
 * Synchronous version (backward-compatible)
 */
export function calculateIncomeTax(monthlyGross: number): IncomeTaxResult {
  return computeIncomeTax(monthlyGross, DEFAULT_TAX_BRACKETS, DEFAULT_LOCAL_INCOME_TAX_RATE)
}

/**
 * Async version reading tax brackets from Settings
 */
export async function calculateIncomeTaxFromSettings(
  monthlyGross: number,
  companyId?: string | null,
): Promise<IncomeTaxResult> {
  interface TaxBracketSettings {
    brackets: TaxBracket[]
    localIncomeTaxRate: number
  }

  const settings = await getPayrollSetting<TaxBracketSettings>(
    'kr-tax-brackets',
    companyId,
  )

  const brackets = settings?.brackets ?? DEFAULT_TAX_BRACKETS
  const localRate = settings?.localIncomeTaxRate ?? DEFAULT_LOCAL_INCOME_TAX_RATE

  // Normalize: API stores max: null for top bracket, computeIncomeTax expects Infinity-like behavior
  const normalizedBrackets = brackets.map((b) => ({
    ...b,
    max: b.max ?? Infinity,
  }))

  return computeIncomeTax(monthlyGross, normalizedBrackets, localRate)
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

/**
 * Async version using Settings-aware calculations
 */
export async function calculateTotalDeductionsFromSettings(
  monthlyGross: number,
  companyId?: string | null,
): Promise<TotalDeductionResult> {
  const socialInsurance = await calculateSocialInsuranceFromSettings(monthlyGross, companyId)
  const incomeTax = await calculateIncomeTaxFromSettings(monthlyGross, companyId)

  return {
    socialInsurance,
    incomeTax,
    totalDeductions: socialInsurance.total + incomeTax.total,
  }
}

// ─── B7-1a: 비과세 분리 ────────────────────────────────────

// Default non-taxable limits (fallback)
const STATUTORY_NON_TAXABLE_DEFAULTS: Record<string, number> = {
  meal_allowance: 200_000,
  vehicle_allowance: 200_000,
  childcare: 100_000,
  MEAL: 200_000,
  VEHICLE: 200_000,
  CHILDCARE: 100_000,
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

/**
 * Settings-aware version of separateTaxableIncome:
 * Fetches non-taxable limits from Settings, merges with statutory defaults.
 */
export async function separateTaxableIncomeFromSettings(
  baseSalary: number,
  overtimePay: number,
  allowances: AllowanceItem[],
  nontaxableLimits: Record<string, number>,
  companyId?: string | null,
): Promise<NontaxableSeparationResult> {
  interface NontaxableSettings {
    meal_allowance: number
    vehicle_allowance: number
    childcare: number
  }

  const settings = await getPayrollSetting<NontaxableSettings>(
    'kr-nontaxable-limits',
    companyId,
  )

  // Merge: explicit limits > settings > statutory defaults
  const mergedLimits: Record<string, number> = {
    ...STATUTORY_NON_TAXABLE_DEFAULTS,
    ...(settings ? {
      meal_allowance: settings.meal_allowance,
      vehicle_allowance: settings.vehicle_allowance,
      childcare: settings.childcare,
      MEAL: settings.meal_allowance,
      VEHICLE: settings.vehicle_allowance,
      CHILDCARE: settings.childcare,
    } : {}),
    ...nontaxableLimits, // explicit overrides win
  }

  return separateTaxableIncome(baseSalary, overtimePay, allowances, mergedLimits)
}

// ─── B7-1a: 일할계산 ──────────────────────────────────────

/**
 * 주어진 연월의 평일(근무일) 수 계산
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
 */
export function calculateProrated(
  monthlyAmount: number,
  year: number,
  month: number,
  hireDate?: Date,
  resignDate?: Date,
): ProrateResult {
  const monthStart = new Date(Date.UTC(year, month - 1, 1))
  const monthEnd = new Date(Date.UTC(year, month, 0))

  const effectiveStart = hireDate && hireDate > monthStart ? hireDate : monthStart
  const effectiveEnd = resignDate && resignDate < monthEnd ? resignDate : monthEnd

  if (effectiveStart <= monthStart && effectiveEnd >= monthEnd) {
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

interface AnomalyThresholds {
  grossChangePercent: number
  overtimeBaseRatio: number
}

/**
 * Synchronous version (backward-compatible)
 */
export function detectPayrollAnomalies(
  current: { grossPay: number; overtimePay: number; baseSalary: number; isProrated: boolean },
  previous: { grossPay: number } | null,
): PayrollAnomalyCheck[] {
  return detectAnomaliesInternal(current, previous, { grossChangePercent: 20, overtimeBaseRatio: 50 })
}

/**
 * Async version using Settings-aware thresholds
 */
export async function detectPayrollAnomaliesFromSettings(
  current: { grossPay: number; overtimePay: number; baseSalary: number; isProrated: boolean },
  previous: { grossPay: number } | null,
  companyId?: string | null,
): Promise<PayrollAnomalyCheck[]> {
  const settings = await getPayrollSetting<AnomalyThresholds>(
    'anomaly-thresholds',
    companyId,
  )

  const thresholds: AnomalyThresholds = {
    grossChangePercent: settings?.grossChangePercent ?? 20,
    overtimeBaseRatio: settings?.overtimeBaseRatio ?? 50,
  }

  return detectAnomaliesInternal(current, previous, thresholds)
}

/** Shared internal implementation */
function detectAnomaliesInternal(
  current: { grossPay: number; overtimePay: number; baseSalary: number; isProrated: boolean },
  previous: { grossPay: number } | null,
  thresholds: AnomalyThresholds,
): PayrollAnomalyCheck[] {
  const anomalies: PayrollAnomalyCheck[] = []

  // 전월 대비 변동
  if (previous && previous.grossPay > 0) {
    const changeRatio = Math.abs(current.grossPay - previous.grossPay) / previous.grossPay
    if (changeRatio > thresholds.grossChangePercent / 100) {
      anomalies.push({
        type: 'WARNING',
        code: 'GROSS_CHANGE_OVER_THRESHOLD',
        message: `총지급액이 전월 대비 ${Math.round(changeRatio * 100)}% 변동 (기준: ${thresholds.grossChangePercent}%)`,
      })
    }
  }

  // 초과근무수당 > 기본급 × ratio
  if (current.baseSalary > 0 && current.overtimePay > current.baseSalary * (thresholds.overtimeBaseRatio / 100)) {
    anomalies.push({
      type: 'WARNING',
      code: 'OVERTIME_OVER_THRESHOLD',
      message: `초과근무수당(${current.overtimePay.toLocaleString()}원)이 기본급의 ${thresholds.overtimeBaseRatio}%를 초과`,
    })
  }

  if (current.isProrated) {
    anomalies.push({ type: 'INFO', code: 'PRORATED', message: '중도입사/퇴사 일할계산 적용' })
  }

  return anomalies
}
