// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Global Payroll Deduction Calculator
// 국가별 급여 공제 계산 (시뮬레이션용)
//
// Refactored (H-2c): async *FromSettings variants added.
// Original synchronous functions preserved for backward compat.
// ═══════════════════════════════════════════════════════════

import {
    calculateSocialInsurance,
    calculateSocialInsuranceFromSettings,
    calculateIncomeTax,
    calculateIncomeTaxFromSettings,
} from './kr-tax'
import { getPayrollSetting } from '@/lib/settings/get-setting'

// ─── 공통 공제 결과 타입 ─────────────────────────────────

export interface SimulationDeductions {
    nationalPension: number
    healthInsurance: number
    longTermCare: number
    employmentInsurance: number
    incomeTax: number
    localIncomeTax: number
    totalDeductions: number
}

// ─── KR: 4대보험 + 소득세 ────────────────────────────────

export function calculateDeductionsKR(monthlyGross: number): SimulationDeductions {
    const si = calculateSocialInsurance(monthlyGross)
    const tax = calculateIncomeTax(monthlyGross)
    return {
        nationalPension: si.nationalPension,
        healthInsurance: si.healthInsurance,
        longTermCare: si.longTermCare,
        employmentInsurance: si.employmentInsurance,
        incomeTax: tax.incomeTax,
        localIncomeTax: tax.localIncomeTax,
        totalDeductions: si.total + tax.total,
    }
}

export async function calculateDeductionsKRFromSettings(
    monthlyGross: number,
    companyId?: string | null,
): Promise<SimulationDeductions> {
    const si = await calculateSocialInsuranceFromSettings(monthlyGross, companyId)
    const tax = await calculateIncomeTaxFromSettings(monthlyGross, companyId)
    return {
        nationalPension: si.nationalPension,
        healthInsurance: si.healthInsurance,
        longTermCare: si.longTermCare,
        employmentInsurance: si.employmentInsurance,
        incomeTax: tax.incomeTax,
        localIncomeTax: tax.localIncomeTax,
        totalDeductions: si.total + tax.total,
    }
}

// ─── US: Social Security + Medicare + Federal Tax ─────────

// Defaults (preserved as fallback)
const US_DEFAULTS = {
    socialSecurityRate: 0.062,
    ssWageBase: 168_600,
    medicareRate: 0.0145,
    default401kRate: 0.06,
}

interface UsDeductionSettings {
    rates: {
        socialSecurityRate: number
        ssWageBase: number
        medicareRate: number
        default401kRate: number
    }
    taxBrackets: Array<{ max: number | null; rate: number }>
}

const US_DEFAULT_BRACKETS = [
    { max: 11_600, rate: 0.10 },
    { max: 47_150, rate: 0.12 },
    { max: 100_525, rate: 0.22 },
    { max: 191_950, rate: 0.24 },
    { max: 243_725, rate: 0.32 },
    { max: 609_350, rate: 0.35 },
    { max: null, rate: 0.37 },
]

function calculateFederalTaxUS(annualTaxable: number, brackets?: Array<{ max: number | null; rate: number }>): number {
    const b = (brackets ?? US_DEFAULT_BRACKETS).map(x => ({ ...x, max: x.max ?? Infinity }))
    let tax = 0
    let prev = 0
    for (const bracket of b) {
        if (annualTaxable <= prev) break
        const taxable = Math.min(annualTaxable, bracket.max) - prev
        tax += taxable * bracket.rate
        prev = bracket.max
    }
    return Math.round(tax)
}

export function calculateDeductionsUS(monthlyGross: number): SimulationDeductions {
    const annualGross = monthlyGross * 12
    const ssBase = Math.min(annualGross, US_DEFAULTS.ssWageBase)
    const socialSecurity = Math.round((ssBase / 12) * US_DEFAULTS.socialSecurityRate)
    const medicare = Math.round(monthlyGross * US_DEFAULTS.medicareRate)
    const contribution401k = Math.round(monthlyGross * US_DEFAULTS.default401kRate)
    const federalTax = Math.round(calculateFederalTaxUS(annualGross) / 12)

    return {
        nationalPension: socialSecurity,
        healthInsurance: contribution401k,
        longTermCare: 0,
        employmentInsurance: medicare,
        incomeTax: federalTax,
        localIncomeTax: 0,
        totalDeductions: socialSecurity + medicare + contribution401k + federalTax,
    }
}

export async function calculateDeductionsUSFromSettings(
    monthlyGross: number,
    companyId?: string | null,
): Promise<SimulationDeductions> {
    const settings = await getPayrollSetting<UsDeductionSettings>('us-deductions', companyId)
    const rates = settings?.rates ?? US_DEFAULTS
    const brackets = settings?.taxBrackets ?? US_DEFAULT_BRACKETS

    const annualGross = monthlyGross * 12
    const ssBase = Math.min(annualGross, rates.ssWageBase ?? US_DEFAULTS.ssWageBase)
    const socialSecurity = Math.round((ssBase / 12) * (rates.socialSecurityRate ?? US_DEFAULTS.socialSecurityRate))
    const medicare = Math.round(monthlyGross * (rates.medicareRate ?? US_DEFAULTS.medicareRate))
    const contribution401k = Math.round(monthlyGross * (rates.default401kRate ?? US_DEFAULTS.default401kRate))
    const federalTax = Math.round(calculateFederalTaxUS(annualGross, brackets) / 12)

    return {
        nationalPension: socialSecurity,
        healthInsurance: contribution401k,
        longTermCare: 0,
        employmentInsurance: medicare,
        incomeTax: federalTax,
        localIncomeTax: 0,
        totalDeductions: socialSecurity + medicare + contribution401k + federalTax,
    }
}

// ─── CN: 五险一金 + 个人所得税 ─────────────────────────────

const CN_DEFAULTS = { pensionRate: 0.08, medicalRate: 0.02, unemploymentRate: 0.005, housingFundRate: 0.12 }
const CN_EXEMPT = 5000
const CN_DEFAULT_BRACKETS = [
    { max: 3000, rate: 0.03, deduction: 0 },
    { max: 12000, rate: 0.10, deduction: 210 },
    { max: 25000, rate: 0.20, deduction: 1410 },
    { max: 35000, rate: 0.25, deduction: 2660 },
    { max: 55000, rate: 0.30, deduction: 4410 },
    { max: 80000, rate: 0.35, deduction: 7160 },
    { max: Infinity, rate: 0.45, deduction: 15160 },
]

interface CnSettings {
    rates: { pensionRate: number; medicalRate: number; unemploymentRate: number; housingFundRate: number }
    exemptAmount: number
    taxBrackets: Array<{ max: number | null; rate: number; deduction: number }>
}

function calculateIncomeTaxCN(
    monthlyTaxable: number,
    exempt: number = CN_EXEMPT,
    brackets: Array<{ max: number; rate: number; deduction: number }> = CN_DEFAULT_BRACKETS,
): number {
    const taxable = Math.max(0, monthlyTaxable - exempt)
    for (const b of brackets) {
        if (taxable <= b.max) {
            return Math.round(taxable * b.rate - b.deduction)
        }
    }
    return 0
}

export function calculateDeductionsCN(monthlyGross: number): SimulationDeductions {
    const pension = Math.round(monthlyGross * CN_DEFAULTS.pensionRate)
    const medical = Math.round(monthlyGross * CN_DEFAULTS.medicalRate)
    const unemployment = Math.round(monthlyGross * CN_DEFAULTS.unemploymentRate)
    const housingFund = Math.round(monthlyGross * CN_DEFAULTS.housingFundRate)
    const totalSocial = pension + medical + unemployment + housingFund
    const taxableIncome = monthlyGross - totalSocial
    const incomeTax = calculateIncomeTaxCN(taxableIncome)

    return {
        nationalPension: pension, healthInsurance: medical, longTermCare: housingFund,
        employmentInsurance: unemployment, incomeTax, localIncomeTax: 0,
        totalDeductions: totalSocial + incomeTax,
    }
}

export async function calculateDeductionsCNFromSettings(
    monthlyGross: number,
    companyId?: string | null,
): Promise<SimulationDeductions> {
    const s = await getPayrollSetting<CnSettings>('cn-deductions', companyId)
    const rates = s?.rates ?? CN_DEFAULTS
    const exempt = s?.exemptAmount ?? CN_EXEMPT
    const brackets = (s?.taxBrackets ?? CN_DEFAULT_BRACKETS).map(b => ({ ...b, max: b.max ?? Infinity }))

    const pension = Math.round(monthlyGross * (rates.pensionRate ?? CN_DEFAULTS.pensionRate))
    const medical = Math.round(monthlyGross * (rates.medicalRate ?? CN_DEFAULTS.medicalRate))
    const unemployment = Math.round(monthlyGross * (rates.unemploymentRate ?? CN_DEFAULTS.unemploymentRate))
    const housingFund = Math.round(monthlyGross * (rates.housingFundRate ?? CN_DEFAULTS.housingFundRate))
    const totalSocial = pension + medical + unemployment + housingFund
    const taxableIncome = monthlyGross - totalSocial
    const incomeTax = calculateIncomeTaxCN(taxableIncome, exempt, brackets)

    return {
        nationalPension: pension, healthInsurance: medical, longTermCare: housingFund,
        employmentInsurance: unemployment, incomeTax, localIncomeTax: 0,
        totalDeductions: totalSocial + incomeTax,
    }
}

// ─── VN: BHXH + BHYT + BHTN + PIT ─────────────────────────

const VN_DEFAULTS = { bhxhRate: 0.08, bhytRate: 0.015, bhtnRate: 0.01 }
const VN_EXEMPT = 11_000_000
const VN_DEFAULT_BRACKETS = [
    { max: 5_000_000, rate: 0.05 }, { max: 10_000_000, rate: 0.10 },
    { max: 18_000_000, rate: 0.15 }, { max: 32_000_000, rate: 0.20 },
    { max: 52_000_000, rate: 0.25 }, { max: 80_000_000, rate: 0.30 },
    { max: Infinity, rate: 0.35 },
]

interface VnSettings {
    rates: { bhxhRate: number; bhytRate: number; bhtnRate: number }
    exemptAmount: number
    taxBrackets: Array<{ max: number | null; rate: number }>
}

function calculateIncomeTaxVN(
    monthlyTaxable: number,
    exempt: number = VN_EXEMPT,
    brackets: Array<{ max: number; rate: number }> = VN_DEFAULT_BRACKETS,
): number {
    const taxable = Math.max(0, monthlyTaxable - exempt)
    let tax = 0, prev = 0
    for (const b of brackets) {
        if (taxable <= prev) break
        const chunk = Math.min(taxable, b.max) - prev
        tax += chunk * b.rate
        prev = b.max
    }
    return Math.round(tax)
}

export function calculateDeductionsVN(monthlyGross: number): SimulationDeductions {
    const bhxh = Math.round(monthlyGross * VN_DEFAULTS.bhxhRate)
    const bhyt = Math.round(monthlyGross * VN_DEFAULTS.bhytRate)
    const bhtn = Math.round(monthlyGross * VN_DEFAULTS.bhtnRate)
    const totalSocial = bhxh + bhyt + bhtn
    const incomeTax = calculateIncomeTaxVN(monthlyGross - totalSocial)

    return {
        nationalPension: bhxh, healthInsurance: bhyt, longTermCare: 0,
        employmentInsurance: bhtn, incomeTax, localIncomeTax: 0,
        totalDeductions: totalSocial + incomeTax,
    }
}

export async function calculateDeductionsVNFromSettings(
    monthlyGross: number,
    companyId?: string | null,
): Promise<SimulationDeductions> {
    const s = await getPayrollSetting<VnSettings>('vn-deductions', companyId)
    const rates = s?.rates ?? VN_DEFAULTS
    const exempt = s?.exemptAmount ?? VN_EXEMPT
    const brackets = (s?.taxBrackets ?? VN_DEFAULT_BRACKETS).map(b => ({ ...b, max: b.max ?? Infinity }))

    const bhxh = Math.round(monthlyGross * (rates.bhxhRate ?? VN_DEFAULTS.bhxhRate))
    const bhyt = Math.round(monthlyGross * (rates.bhytRate ?? VN_DEFAULTS.bhytRate))
    const bhtn = Math.round(monthlyGross * (rates.bhtnRate ?? VN_DEFAULTS.bhtnRate))
    const totalSocial = bhxh + bhyt + bhtn
    const incomeTax = calculateIncomeTaxVN(monthlyGross - totalSocial, exempt, brackets)

    return {
        nationalPension: bhxh, healthInsurance: bhyt, longTermCare: 0,
        employmentInsurance: bhtn, incomeTax, localIncomeTax: 0,
        totalDeductions: totalSocial + incomeTax,
    }
}

// ─── RU: НДФЛ flat ───────────────────────────────────────

const RU_NDFL_RATE = 0.13

export function calculateDeductionsRU(monthlyGross: number): SimulationDeductions {
    const incomeTax = Math.round(monthlyGross * RU_NDFL_RATE)
    return { nationalPension: 0, healthInsurance: 0, longTermCare: 0, employmentInsurance: 0, incomeTax, localIncomeTax: 0, totalDeductions: incomeTax }
}

export async function calculateDeductionsRUFromSettings(
    monthlyGross: number,
    companyId?: string | null,
): Promise<SimulationDeductions> {
    const s = await getPayrollSetting<{ rates: { ndflRate: number } }>('ru-deductions', companyId)
    const rate = s?.rates?.ndflRate ?? RU_NDFL_RATE
    const incomeTax = Math.round(monthlyGross * rate)
    return { nationalPension: 0, healthInsurance: 0, longTermCare: 0, employmentInsurance: 0, incomeTax, localIncomeTax: 0, totalDeductions: incomeTax }
}

// ─── PL: ZUS + Zdrowotna + PIT + PPK ────────────────────

const PL_DEFAULTS = {
    pensionRate: 0.0976,
    disabilityRate: 0.015,
    sicknessRate: 0.0245,
    healthInsuranceRate: 0.09,
    taxFreeAmount: 30_000,
    ppkRate: 0.02,
}
const PL_DEFAULT_BRACKETS = [
    { upTo: 120_000, rate: 0.12 },
    { upTo: Infinity, rate: 0.32 },
]

interface PlSettings {
    pensionRate: number
    disabilityRate: number
    sicknessRate: number
    healthInsuranceRate: number
    taxBrackets: Array<{ upTo: number | null; rate: number }>
    taxFreeAmount: number
    ppkRate: number
}

function calculateIncomeTaxPL(
    annualTaxable: number,
    taxFreeAmount: number = PL_DEFAULTS.taxFreeAmount,
    brackets: Array<{ upTo: number; rate: number }> = PL_DEFAULT_BRACKETS,
): number {
    const taxable = Math.max(0, annualTaxable - taxFreeAmount)
    let tax = 0
    let prev = 0
    for (const b of brackets) {
        if (taxable <= prev) break
        const chunk = Math.min(taxable, b.upTo) - prev
        tax += chunk * b.rate
        prev = b.upTo
    }
    return Math.round(tax)
}

export function calculateDeductionsPL(monthlyGross: number): SimulationDeductions {
    const pension = Math.round(monthlyGross * PL_DEFAULTS.pensionRate)
    const disability = Math.round(monthlyGross * PL_DEFAULTS.disabilityRate)
    const sickness = Math.round(monthlyGross * PL_DEFAULTS.sicknessRate)
    const zusBasis = monthlyGross - pension - disability - sickness
    const healthInsurance = Math.round(zusBasis * PL_DEFAULTS.healthInsuranceRate)
    const ppk = Math.round(monthlyGross * PL_DEFAULTS.ppkRate)
    const totalSocial = pension + disability + sickness + healthInsurance + ppk
    const annualGross = monthlyGross * 12
    const annualZus = (pension + disability + sickness) * 12
    const incomeTax = Math.round(calculateIncomeTaxPL(annualGross - annualZus) / 12)

    return {
        nationalPension: pension,
        healthInsurance: healthInsurance,
        longTermCare: ppk,
        employmentInsurance: disability + sickness,
        incomeTax,
        localIncomeTax: 0,
        totalDeductions: totalSocial + incomeTax,
    }
}

export async function calculateDeductionsPLFromSettings(
    monthlyGross: number,
    companyId?: string | null,
): Promise<SimulationDeductions> {
    const s = await getPayrollSetting<PlSettings>('pl-deductions', companyId)
    const pensionRate = s?.pensionRate ?? PL_DEFAULTS.pensionRate
    const disabilityRate = s?.disabilityRate ?? PL_DEFAULTS.disabilityRate
    const sicknessRate = s?.sicknessRate ?? PL_DEFAULTS.sicknessRate
    const healthRate = s?.healthInsuranceRate ?? PL_DEFAULTS.healthInsuranceRate
    const ppkRate = s?.ppkRate ?? PL_DEFAULTS.ppkRate
    const taxFree = s?.taxFreeAmount ?? PL_DEFAULTS.taxFreeAmount
    const brackets = (s?.taxBrackets ?? PL_DEFAULT_BRACKETS).map(b => ({ ...b, upTo: b.upTo ?? Infinity }))

    const pension = Math.round(monthlyGross * pensionRate)
    const disability = Math.round(monthlyGross * disabilityRate)
    const sickness = Math.round(monthlyGross * sicknessRate)
    const zusBasis = monthlyGross - pension - disability - sickness
    const healthInsurance = Math.round(zusBasis * healthRate)
    const ppk = Math.round(monthlyGross * ppkRate)
    const totalSocial = pension + disability + sickness + healthInsurance + ppk
    const annualGross = monthlyGross * 12
    const annualZus = (pension + disability + sickness) * 12
    const incomeTax = Math.round(calculateIncomeTaxPL(annualGross - annualZus, taxFree, brackets) / 12)

    return {
        nationalPension: pension,
        healthInsurance: healthInsurance,
        longTermCare: ppk,
        employmentInsurance: disability + sickness,
        incomeTax,
        localIncomeTax: 0,
        totalDeductions: totalSocial + incomeTax,
    }
}

// ─── MX: IMSS + ISR ──────────────────────────────────────

const MX_IMSS_RATE = 0.025
const MX_DEFAULT_BRACKETS = [
    { max: 746.04, rate: 0.0192, base: 0 },
    { max: 6_332.05, rate: 0.064, base: 14.32 },
    { max: 11_128.01, rate: 0.1088, base: 371.83 },
    { max: 12_935.82, rate: 0.16, base: 893.63 },
    { max: 15_487.71, rate: 0.1792, base: 1_182.88 },
    { max: 31_236.49, rate: 0.2136, base: 1_640.18 },
    { max: 49_233.00, rate: 0.2352, base: 5_004.12 },
    { max: 93_993.90, rate: 0.30, base: 9_236.89 },
    { max: 125_325.20, rate: 0.32, base: 22_665.17 },
    { max: 375_975.61, rate: 0.34, base: 32_691.18 },
    { max: Infinity, rate: 0.35, base: 117_912.32 },
]

interface MxSettings {
    rates: { imssRate: number }
    taxBrackets: Array<{ max: number | null; rate: number; base: number }>
}

function calculateISR(
    monthlyGross: number,
    brackets: Array<{ max: number; rate: number; base: number }> = MX_DEFAULT_BRACKETS,
): number {
    for (const b of brackets) {
        if (monthlyGross <= b.max) {
            const prevMax = brackets[brackets.indexOf(b) - 1]?.max ?? 0
            const excess = monthlyGross - prevMax
            return Math.round(b.base + excess * b.rate)
        }
    }
    return 0
}

export function calculateDeductionsMX(monthlyGross: number): SimulationDeductions {
    const imss = Math.round(monthlyGross * MX_IMSS_RATE)
    const isr = calculateISR(monthlyGross)
    return { nationalPension: 0, healthInsurance: imss, longTermCare: 0, employmentInsurance: 0, incomeTax: isr, localIncomeTax: 0, totalDeductions: imss + isr }
}

export async function calculateDeductionsMXFromSettings(
    monthlyGross: number,
    companyId?: string | null,
): Promise<SimulationDeductions> {
    const s = await getPayrollSetting<MxSettings>('mx-deductions', companyId)
    const imssRate = s?.rates?.imssRate ?? MX_IMSS_RATE
    const brackets = (s?.taxBrackets ?? MX_DEFAULT_BRACKETS).map(b => ({ ...b, max: b.max ?? Infinity }))

    const imss = Math.round(monthlyGross * imssRate)
    const isr = calculateISR(monthlyGross, brackets)
    return { nationalPension: 0, healthInsurance: imss, longTermCare: 0, employmentInsurance: 0, incomeTax: isr, localIncomeTax: 0, totalDeductions: imss + isr }
}

// ─── Country dispatcher ──────────────────────────────────

/** Synchronous version (backward compatible) */
export function calculateDeductionsByCountry(
    companyCode: string,
    monthlyGross: number,
): SimulationDeductions {
    const code = companyCode.toUpperCase()
    if (code.includes('KR') || code.includes('HQ')) return calculateDeductionsKR(monthlyGross)
    if (code.includes('US')) return calculateDeductionsUS(monthlyGross)
    if (code.includes('CN')) return calculateDeductionsCN(monthlyGross)
    if (code.includes('VN')) return calculateDeductionsVN(monthlyGross)
    if (code.includes('RU')) return calculateDeductionsRU(monthlyGross)
    if (code.includes('MX')) return calculateDeductionsMX(monthlyGross)
    if (code.includes('PL') || code.includes('EU')) return calculateDeductionsPL(monthlyGross)
    return calculateDeductionsKR(monthlyGross) // Fallback
}

/** Async version — reads per-country rates from Settings */
export async function calculateDeductionsByCountryFromSettings(
    companyCode: string,
    monthlyGross: number,
    companyId?: string | null,
): Promise<SimulationDeductions> {
    const code = companyCode.toUpperCase()
    if (code.includes('KR') || code.includes('HQ')) return calculateDeductionsKRFromSettings(monthlyGross, companyId)
    if (code.includes('US')) return calculateDeductionsUSFromSettings(monthlyGross, companyId)
    if (code.includes('CN')) return calculateDeductionsCNFromSettings(monthlyGross, companyId)
    if (code.includes('VN')) return calculateDeductionsVNFromSettings(monthlyGross, companyId)
    if (code.includes('RU')) return calculateDeductionsRUFromSettings(monthlyGross, companyId)
    if (code.includes('MX')) return calculateDeductionsMXFromSettings(monthlyGross, companyId)
    if (code.includes('PL') || code.includes('EU')) return calculateDeductionsPLFromSettings(monthlyGross, companyId)
    return calculateDeductionsKRFromSettings(monthlyGross, companyId) // Fallback
}
