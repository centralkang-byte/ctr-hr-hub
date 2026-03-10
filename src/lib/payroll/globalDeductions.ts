// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Global Payroll Deduction Calculator
// 국가별 급여 공제 계산 (시뮬레이션용)
// ═══════════════════════════════════════════════════════════
//
// KR: 4대보험 + 소득세 — kr-tax.ts 재사용
// US/CN/VN/RU/MX: 순수 함수로 정의
// ═══════════════════════════════════════════════════════════

import {
    calculateSocialInsurance,
    calculateIncomeTax,
} from './kr-tax'

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

// ─── KR: 4대보험 + 소득세 (기존 kr-tax.ts 재사용) ────────

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

// ─── US: Social Security + Medicare + Federal Tax ─────────

// TODO: Move to Settings (Payroll) — US Social Security rate 6.2%
const US_SOCIAL_SECURITY_RATE = 0.062
// TODO: Move to Settings (Payroll) — US Social Security wage base $168,600 (2025)
const US_SS_WAGE_BASE = 168_600
// TODO: Move to Settings (Payroll) — US Medicare rate 1.45%
const US_MEDICARE_RATE = 0.0145
// TODO: Move to Settings (Payroll) — US 401k default contribution 6%
const US_401K_DEFAULT_RATE = 0.06

function calculateFederalTaxUS(annualTaxable: number): number {
    // TODO: Move to Settings (Payroll) — US Federal tax brackets (2025, Single)
    const brackets = [
        { max: 11_600, rate: 0.10 },
        { max: 47_150, rate: 0.12 },
        { max: 100_525, rate: 0.22 },
        { max: 191_950, rate: 0.24 },
        { max: 243_725, rate: 0.32 },
        { max: 609_350, rate: 0.35 },
        { max: Infinity, rate: 0.37 },
    ]
    let tax = 0
    let prev = 0
    for (const b of brackets) {
        if (annualTaxable <= prev) break
        const taxable = Math.min(annualTaxable, b.max) - prev
        tax += taxable * b.rate
        prev = b.max
    }
    return Math.round(tax)
}

export function calculateDeductionsUS(monthlyGross: number): SimulationDeductions {
    const annualGross = monthlyGross * 12
    const ssBase = Math.min(annualGross, US_SS_WAGE_BASE)
    const socialSecurity = Math.round((ssBase / 12) * US_SOCIAL_SECURITY_RATE)
    const medicare = Math.round(monthlyGross * US_MEDICARE_RATE)
    const contribution401k = Math.round(monthlyGross * US_401K_DEFAULT_RATE)
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

// ─── CN: 五险一金 + 个人所得税 ─────────────────────────────

// TODO: Move to Settings (Payroll) — CN 养老保险 8%
const CN_PENSION_RATE = 0.08
// TODO: Move to Settings (Payroll) — CN 医疗保险 2%
const CN_MEDICAL_RATE = 0.02
// TODO: Move to Settings (Payroll) — CN 失业保险 0.5%
const CN_UNEMPLOYMENT_RATE = 0.005
// TODO: Move to Settings (Payroll) — CN 住房公积金 12%
const CN_HOUSING_FUND_RATE = 0.12

function calculateIncomeTaxCN(monthlyTaxable: number): number {
    // TODO: Move to Settings (Payroll) — CN income tax brackets (monthly, after 5000 exemption)
    const exempt = 5000
    const taxable = Math.max(0, monthlyTaxable - exempt)
    const brackets = [
        { max: 3000, rate: 0.03, deduction: 0 },
        { max: 12000, rate: 0.10, deduction: 210 },
        { max: 25000, rate: 0.20, deduction: 1410 },
        { max: 35000, rate: 0.25, deduction: 2660 },
        { max: 55000, rate: 0.30, deduction: 4410 },
        { max: 80000, rate: 0.35, deduction: 7160 },
        { max: Infinity, rate: 0.45, deduction: 15160 },
    ]

    for (const b of brackets) {
        if (taxable <= b.max) {
            return Math.round(taxable * b.rate - b.deduction)
        }
    }
    return 0
}

export function calculateDeductionsCN(monthlyGross: number): SimulationDeductions {
    const pension = Math.round(monthlyGross * CN_PENSION_RATE)
    const medical = Math.round(monthlyGross * CN_MEDICAL_RATE)
    const unemployment = Math.round(monthlyGross * CN_UNEMPLOYMENT_RATE)
    const housingFund = Math.round(monthlyGross * CN_HOUSING_FUND_RATE)
    const totalSocial = pension + medical + unemployment + housingFund
    const taxableIncome = monthlyGross - totalSocial
    const incomeTax = calculateIncomeTaxCN(taxableIncome)

    return {
        nationalPension: pension,
        healthInsurance: medical,
        longTermCare: housingFund,
        employmentInsurance: unemployment,
        incomeTax,
        localIncomeTax: 0,
        totalDeductions: totalSocial + incomeTax,
    }
}

// ─── VN: BHXH + BHYT + BHTN + PIT ─────────────────────────

// TODO: Move to Settings (Payroll) — VN BHXH (Social Insurance) 8%
const VN_BHXH_RATE = 0.08
// TODO: Move to Settings (Payroll) — VN BHYT (Health Insurance) 1.5%
const VN_BHYT_RATE = 0.015
// TODO: Move to Settings (Payroll) — VN BHTN (Unemployment Insurance) 1%
const VN_BHTN_RATE = 0.01

function calculateIncomeTaxVN(monthlyTaxable: number): number {
    // TODO: Move to Settings (Payroll) — VN PIT brackets (monthly, after 11M exemption)
    const exempt = 11_000_000
    const taxable = Math.max(0, monthlyTaxable - exempt)
    const brackets = [
        { max: 5_000_000, rate: 0.05 },
        { max: 10_000_000, rate: 0.10 },
        { max: 18_000_000, rate: 0.15 },
        { max: 32_000_000, rate: 0.20 },
        { max: 52_000_000, rate: 0.25 },
        { max: 80_000_000, rate: 0.30 },
        { max: Infinity, rate: 0.35 },
    ]
    let tax = 0
    let prev = 0
    for (const b of brackets) {
        if (taxable <= prev) break
        const chunk = Math.min(taxable, b.max) - prev
        tax += chunk * b.rate
        prev = b.max
    }
    return Math.round(tax)
}

export function calculateDeductionsVN(monthlyGross: number): SimulationDeductions {
    const bhxh = Math.round(monthlyGross * VN_BHXH_RATE)
    const bhyt = Math.round(monthlyGross * VN_BHYT_RATE)
    const bhtn = Math.round(monthlyGross * VN_BHTN_RATE)
    const totalSocial = bhxh + bhyt + bhtn
    const taxableIncome = monthlyGross - totalSocial
    const incomeTax = calculateIncomeTaxVN(taxableIncome)

    return {
        nationalPension: bhxh,
        healthInsurance: bhyt,
        longTermCare: 0,
        employmentInsurance: bhtn,
        incomeTax,
        localIncomeTax: 0,
        totalDeductions: totalSocial + incomeTax,
    }
}

// ─── RU: НДФЛ 13% flat ───────────────────────────────────

// TODO: Move to Settings (Payroll) — RU NDFL flat rate 13%
const RU_NDFL_RATE = 0.13

export function calculateDeductionsRU(monthlyGross: number): SimulationDeductions {
    const incomeTax = Math.round(monthlyGross * RU_NDFL_RATE)

    return {
        nationalPension: 0,
        healthInsurance: 0,
        longTermCare: 0,
        employmentInsurance: 0,
        incomeTax,
        localIncomeTax: 0,
        totalDeductions: incomeTax,
    }
}

// ─── MX: IMSS + ISR ──────────────────────────────────────

// TODO: Move to Settings (Payroll) — MX IMSS employee contribution ~2.5%
const MX_IMSS_RATE = 0.025

function calculateISR(monthlyGross: number): number {
    // TODO: Move to Settings (Payroll) — MX ISR tax brackets (monthly, 2025)
    const brackets = [
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

    for (const b of brackets) {
        if (monthlyGross <= b.max) {
            const excess = monthlyGross - (brackets[brackets.indexOf(b) - 1]?.max ?? 0)
            return Math.round(b.base + excess * b.rate)
        }
    }
    return 0
}

export function calculateDeductionsMX(monthlyGross: number): SimulationDeductions {
    const imss = Math.round(monthlyGross * MX_IMSS_RATE)
    const isr = calculateISR(monthlyGross)

    return {
        nationalPension: 0,
        healthInsurance: imss,
        longTermCare: 0,
        employmentInsurance: 0,
        incomeTax: isr,
        localIncomeTax: 0,
        totalDeductions: imss + isr,
    }
}

// ─── Country dispatcher ──────────────────────────────────

export function calculateDeductionsByCountry(
    companyCode: string,
    monthlyGross: number,
): SimulationDeductions {
    const code = companyCode.toUpperCase()

    if (code.includes('KR') || code.includes('HQ')) {
        return calculateDeductionsKR(monthlyGross)
    }
    if (code.includes('US')) return calculateDeductionsUS(monthlyGross)
    if (code.includes('CN')) return calculateDeductionsCN(monthlyGross)
    if (code.includes('VN')) return calculateDeductionsVN(monthlyGross)
    if (code.includes('RU')) return calculateDeductionsRU(monthlyGross)
    if (code.includes('MX')) return calculateDeductionsMX(monthlyGross)

    // Fallback: KR
    return calculateDeductionsKR(monthlyGross)
}
