// ═══════════════════════════════════════════════════════════
// Unit Tests — Global Payroll Deduction Calculators (sync)
// src/lib/payroll/globalDeductions.ts
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  calculateDeductionsKR,
  calculateDeductionsUS,
  calculateDeductionsCN,
  calculateDeductionsVN,
  calculateDeductionsRU,
  calculateDeductionsPL,
  calculateDeductionsMX,
  calculateDeductionsByCountry,
} from '@/lib/payroll/globalDeductions'

// Helper: verify SimulationDeductions shape and totalDeductions consistency
function expectValidDeductions(result: ReturnType<typeof calculateDeductionsRU>) {
  expect(result.totalDeductions).toBe(
    result.nationalPension + result.healthInsurance + result.longTermCare +
    result.employmentInsurance + result.incomeTax + result.localIncomeTax,
  )
}

// ─── RU: NDFL flat 13% ──────────────────────────────────────

describe('calculateDeductionsRU', () => {
  it('should return all zeros for zero gross', () => {
    const r = calculateDeductionsRU(0)
    expect(r.totalDeductions).toBe(0)
    expect(r.incomeTax).toBe(0)
  })

  it('should calculate 13% flat NDFL with no social', () => {
    const r = calculateDeductionsRU(100_000)
    expect(r.incomeTax).toBe(13_000)
    expect(r.nationalPension).toBe(0)
    expect(r.healthInsurance).toBe(0)
    expect(r.totalDeductions).toBe(13_000)
  })
})

// ─── US: SS + Medicare + 401k + Federal Tax ─────────────────

describe('calculateDeductionsUS', () => {
  it('should calculate standard deductions for 10,000/month', () => {
    const r = calculateDeductionsUS(10_000)
    expect(r.nationalPension).toBeGreaterThan(0) // Social Security
    expect(r.employmentInsurance).toBeGreaterThan(0) // Medicare
    expect(r.healthInsurance).toBeGreaterThan(0) // 401k
    expect(r.incomeTax).toBeGreaterThan(0) // Federal Tax
    expectValidDeductions(r)
  })

  it('should cap Social Security at wage base (168,600 annual)', () => {
    // monthlyGross 20,000 → annual 240,000 > 168,600
    const r = calculateDeductionsUS(20_000)
    // SS = round((168600/12) * 0.062) = round(14050 * 0.062) = round(870.1) = 870
    const expectedSS = Math.round((168_600 / 12) * 0.062)
    expect(r.nationalPension).toBe(expectedSS)
    expectValidDeductions(r)
  })
})

// ─── CN: 五险一金 + 个税 ────────────────────────────────────

describe('calculateDeductionsCN', () => {
  it('should calculate Chinese deductions for 15,000 CNY', () => {
    const r = calculateDeductionsCN(15_000)
    // Pension 8%, Medical 2%, Unemployment 0.5%, Housing 12%
    expect(r.nationalPension).toBe(Math.round(15_000 * 0.08))
    expect(r.healthInsurance).toBe(Math.round(15_000 * 0.02))
    expect(r.employmentInsurance).toBe(Math.round(15_000 * 0.005))
    expect(r.longTermCare).toBe(Math.round(15_000 * 0.12)) // housing fund
    expect(r.incomeTax).toBeGreaterThanOrEqual(0)
    expectValidDeductions(r)
  })
})

// ─── VN: BHXH + BHYT + BHTN + PIT ──────────────────────────

describe('calculateDeductionsVN', () => {
  it('should calculate Vietnamese deductions for 30M VND', () => {
    const r = calculateDeductionsVN(30_000_000)
    // BHXH 8%, BHYT 1.5%, BHTN 1%
    expect(r.nationalPension).toBe(Math.round(30_000_000 * 0.08))
    expect(r.healthInsurance).toBe(Math.round(30_000_000 * 0.015))
    expect(r.employmentInsurance).toBe(Math.round(30_000_000 * 0.01))
    expect(r.incomeTax).toBeGreaterThan(0) // PIT on amount above exempt
    expectValidDeductions(r)
  })
})

// ─── PL: ZUS + Zdrowotna + PIT + PPK ───────────────────────

describe('calculateDeductionsPL', () => {
  it('should calculate Polish deductions for 10,000 PLN', () => {
    const r = calculateDeductionsPL(10_000)
    expect(r.nationalPension).toBe(Math.round(10_000 * 0.0976)) // pension
    expect(r.longTermCare).toBe(Math.round(10_000 * 0.02)) // PPK
    expect(r.employmentInsurance).toBeGreaterThan(0) // disability + sickness
    expect(r.healthInsurance).toBeGreaterThan(0)
    expect(r.incomeTax).toBeGreaterThanOrEqual(0)
    expectValidDeductions(r)
  })
})

// ─── MX: IMSS + ISR ────────────────────────────────────────

describe('calculateDeductionsMX', () => {
  it('should calculate Mexican deductions for 20,000 MXN', () => {
    const r = calculateDeductionsMX(20_000)
    expect(r.healthInsurance).toBe(Math.round(20_000 * 0.025)) // IMSS
    expect(r.incomeTax).toBeGreaterThan(0) // ISR
    expectValidDeductions(r)
  })
})

// ─── Country Dispatcher ─────────────────────────────────────

describe('calculateDeductionsByCountry', () => {
  const gross = 3_000_000

  it('should dispatch KR/HQ codes to Korean calculator', () => {
    const kr = calculateDeductionsByCountry('CTR-KR', gross)
    const hq = calculateDeductionsByCountry('CTR-HQ', gross)
    const direct = calculateDeductionsKR(gross)
    expect(kr).toEqual(direct)
    expect(hq).toEqual(direct)
  })

  it('should dispatch country codes to correct calculators', () => {
    expect(calculateDeductionsByCountry('CTR-US', 10_000)).toEqual(calculateDeductionsUS(10_000))
    expect(calculateDeductionsByCountry('CTR-CN', 15_000)).toEqual(calculateDeductionsCN(15_000))
    expect(calculateDeductionsByCountry('CTR-VN', 30_000_000)).toEqual(calculateDeductionsVN(30_000_000))
    expect(calculateDeductionsByCountry('CTR-RU', 100_000)).toEqual(calculateDeductionsRU(100_000))
    expect(calculateDeductionsByCountry('CTR-MX', 20_000)).toEqual(calculateDeductionsMX(20_000))
  })

  it('should dispatch PL and EU to Polish calculator', () => {
    expect(calculateDeductionsByCountry('CTR-PL', 10_000)).toEqual(calculateDeductionsPL(10_000))
    expect(calculateDeductionsByCountry('CTR-EU', 10_000)).toEqual(calculateDeductionsPL(10_000))
  })

  it('should fall back to KR for unknown company code', () => {
    const unknown = calculateDeductionsByCountry('CTR-UNKNOWN', gross)
    const kr = calculateDeductionsKR(gross)
    expect(unknown).toEqual(kr)
  })

  it('should handle case insensitivity', () => {
    const lower = calculateDeductionsByCountry('ctr-us', 10_000)
    const upper = calculateDeductionsByCountry('CTR-US', 10_000)
    expect(lower).toEqual(upper)
  })
})
