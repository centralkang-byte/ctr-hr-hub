import { describe, it, expect } from 'vitest'
import { normaliseDetail } from '@/lib/payroll/normalise-detail'

// Wave 1 X-1: PayStubDetailClient 로컬 사본 → SSOT 흡수 가드.
// fixture 의무 목록(Codex G1 P2): engine / legacy / already-normalised / NaN / otherDeductions

// ─── Fixtures ───────────────────────────────────────────────

const ENGINE_DETAIL = {
  earnings: {
    baseSalary: 3_000_000,
    fixedOvertimeAllowance: 0,
    mealAllowance: 200_000,
    transportAllowance: 100_000,
    overtimePay: 0,
    nightShiftPay: 0,
    holidayPay: 0,
    bonuses: 0,
    otherEarnings: 0,
  },
  insurance: {
    nationalPension: 135_000,
    healthInsurance: 106_350,
    longTermCare: 13_770,
    employmentInsurance: 27_000,
  },
  tax: { incomeTax: 84_850, localIncomeTax: 8_480 },
}

const ALREADY_NORMALISED_DETAIL = {
  earnings: ENGINE_DETAIL.earnings,
  // engine 포맷이지만 deductions가 이미 평탄화돼 있는 사본 — insurance/tax 무시하고 그대로 써야 한다
  deductions: {
    nationalPension: 1,
    healthInsurance: 2,
    longTermCare: 3,
    employmentInsurance: 4,
    incomeTax: 5,
    localIncomeTax: 6,
    otherDeductions: 7,
  },
  insurance: { nationalPension: 999_999 },
}

const LEGACY_DETAIL = {
  grade: 'L2',
  components: { base: 2_500_000, meal: 150_000, overtime: 120_000, positionAllowance: 80_000 },
  deductions: {
    nationalPension: 112_500,
    healthInsurance: 88_600,
    incomeTax: 41_630,
  },
}

// ─── engine 포맷 ────────────────────────────────────────────

describe('normaliseDetail — engine format', () => {
  it('merges insurance + tax into deductions and sums totalDeductions', () => {
    const r = normaliseDetail(ENGINE_DETAIL, 3_300_000, 2_924_550)
    expect(r).not.toBeNull()
    expect(r!.deductions.nationalPension).toBe(135_000)
    expect(r!.deductions.incomeTax).toBe(84_850)
    expect(r!.totalDeductions).toBe(135_000 + 106_350 + 13_770 + 27_000 + 84_850 + 8_480)
    expect(r!.grossPay).toBe(3_300_000)
    expect(r!.netPay).toBe(2_924_550)
  })

  it('keeps pre-flattened deductions as-is (already-normalised copy)', () => {
    const r = normaliseDetail(ALREADY_NORMALISED_DETAIL, 100, 70)
    expect(r!.deductions.nationalPension).toBe(1)
    expect(r!.deductions.otherDeductions).toBe(7)
    expect(r!.totalDeductions).toBe(1 + 2 + 3 + 4 + 5 + 6 + 7)
  })
})

// ─── legacy seed 포맷 ───────────────────────────────────────

describe('normaliseDetail — legacy seed format', () => {
  it('maps components → earnings (positionAllowance → otherEarnings)', () => {
    const r = normaliseDetail(LEGACY_DETAIL, 2_850_000, 2_607_270)
    expect(r!.earnings.baseSalary).toBe(2_500_000)
    expect(r!.earnings.mealAllowance).toBe(150_000)
    expect(r!.earnings.overtimePay).toBe(120_000)
    expect(r!.earnings.otherEarnings).toBe(80_000)
    expect(r!.totalDeductions).toBe(112_500 + 88_600 + 41_630)
  })

  it('preserves stored otherDeductions (X-1 superset — 기존 SSOT는 0 고정 유실)', () => {
    const r = normaliseDetail(
      { components: { base: 1_000 }, deductions: { incomeTax: 10, otherDeductions: 33 } },
      1_000,
      957,
    )
    expect(r!.deductions.otherDeductions).toBe(33)
    expect(r!.totalDeductions).toBe(43)
  })
})

// ─── malformed 입력 가드 ────────────────────────────────────

describe('normaliseDetail — malformed inputs', () => {
  it('returns null for null / non-object detail', () => {
    expect(normaliseDetail(null, 100, 70)).toBeNull()
    expect(normaliseDetail(undefined, 100, 70)).toBeNull()
    expect(normaliseDetail('not-an-object', 100, 70)).toBeNull()
  })

  it('coerces NaN/Infinity gross·net to 0 (Number.isFinite guard)', () => {
    const engine = normaliseDetail(ENGINE_DETAIL, NaN, Infinity)
    expect(engine!.grossPay).toBe(0)
    expect(engine!.netPay).toBe(0)

    const legacy = normaliseDetail(LEGACY_DETAIL, NaN, NaN)
    expect(legacy!.grossPay).toBe(0)
    expect(legacy!.netPay).toBe(0)
  })

  it('coerces numeric strings (Decimal 직렬화) to numbers', () => {
    const r = normaliseDetail(LEGACY_DETAIL, '2850000' as unknown as number, '2607270' as unknown as number)
    expect(r!.grossPay).toBe(2_850_000)
    expect(r!.netPay).toBe(2_607_270)
  })
})
