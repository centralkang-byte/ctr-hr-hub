// ═══════════════════════════════════════════════════════════
// CTR HR Hub — South Korea Tax Brackets (KR)
// ═══════════════════════════════════════════════════════════
// 소득세: 6단계 누진세 (6%~45%)
// 4대보험: 국민연금, 건강보험, 장기요양보험, 고용보험

import type { TaxBracketConfig } from './index'

// ─── Income Tax (근로소득세) ─────────────────────────────
// 2024년 기준 소득세율표

export const KR_TAX_BRACKETS: TaxBracketConfig[] = [
  {
    name: '소득세 1구간',
    taxType: 'INCOME_TAX',
    bracketMin: 0,
    bracketMax: 14_000_000,
    rate: 0.06,
    fixedAmount: 0,
    description: '1,400만원 이하: 6%',
  },
  {
    name: '소득세 2구간',
    taxType: 'INCOME_TAX',
    bracketMin: 14_000_000,
    bracketMax: 50_000_000,
    rate: 0.15,
    fixedAmount: 0,
    description: '1,400만원~5,000만원: 15%',
  },
  {
    name: '소득세 3구간',
    taxType: 'INCOME_TAX',
    bracketMin: 50_000_000,
    bracketMax: 88_000_000,
    rate: 0.24,
    fixedAmount: 0,
    description: '5,000만원~8,800만원: 24%',
  },
  {
    name: '소득세 4구간',
    taxType: 'INCOME_TAX',
    bracketMin: 88_000_000,
    bracketMax: 150_000_000,
    rate: 0.35,
    fixedAmount: 0,
    description: '8,800만원~1.5억: 35%',
  },
  {
    name: '소득세 5구간',
    taxType: 'INCOME_TAX',
    bracketMin: 150_000_000,
    bracketMax: 300_000_000,
    rate: 0.38,
    fixedAmount: 0,
    description: '1.5억~3억: 38%',
  },
  {
    name: '소득세 6구간',
    taxType: 'INCOME_TAX',
    bracketMin: 300_000_000,
    bracketMax: 500_000_000,
    rate: 0.40,
    fixedAmount: 0,
    description: '3억~5억: 40%',
  },
  {
    name: '소득세 7구간',
    taxType: 'INCOME_TAX',
    bracketMin: 500_000_000,
    bracketMax: 1_000_000_000,
    rate: 0.42,
    fixedAmount: 0,
    description: '5억~10억: 42%',
  },
  {
    name: '소득세 8구간',
    taxType: 'INCOME_TAX',
    bracketMin: 1_000_000_000,
    bracketMax: null,
    rate: 0.45,
    fixedAmount: 0,
    description: '10억 초과: 45%',
  },
  {
    name: '지방소득세',
    taxType: 'LOCAL_TAX',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.10,
    fixedAmount: 0,
    description: '소득세의 10% (소득세에 부가)',
  },
]

// ─── Social Insurance (4대보험 — 근로자 부담분) ──────────

export const KR_SOCIAL_INSURANCE: TaxBracketConfig[] = [
  {
    name: '국민연금',
    taxType: 'PENSION',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.045,
    fixedAmount: 0,
    description: '국민연금 근로자 부담분 4.5% (상한 월 590만원)',
  },
  {
    name: '건강보험',
    taxType: 'HEALTH_INSURANCE',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.03545,
    fixedAmount: 0,
    description: '건강보험 근로자 부담분 3.545%',
  },
  {
    name: '장기요양보험',
    taxType: 'HEALTH_INSURANCE',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.004541,
    fixedAmount: 0,
    description: '장기요양보험 = 건강보험료의 12.81%',
  },
  {
    name: '고용보험',
    taxType: 'SOCIAL_INSURANCE',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.009,
    fixedAmount: 0,
    description: '고용보험 근로자 부담분 0.9%',
  },
]
