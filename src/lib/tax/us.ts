// ═══════════════════════════════════════════════════════════
// CTR HR Hub — United States Tax Brackets (US)
// ═══════════════════════════════════════════════════════════
// Federal Income Tax: 7 brackets (10%~37%)
// FICA: Social Security 6.2%, Medicare 1.45%

import type { TaxBracketConfig } from './index'

// ─── Federal Income Tax ──────────────────────────────────
// 2024 Single filer brackets (annual, USD)

export const US_TAX_BRACKETS: TaxBracketConfig[] = [
  {
    name: 'Federal Income Tax — 10%',
    taxType: 'INCOME_TAX',
    bracketMin: 0,
    bracketMax: 11_600,
    rate: 0.10,
    fixedAmount: 0,
    description: 'Up to $11,600: 10%',
  },
  {
    name: 'Federal Income Tax — 12%',
    taxType: 'INCOME_TAX',
    bracketMin: 11_600,
    bracketMax: 47_150,
    rate: 0.12,
    fixedAmount: 0,
    description: '$11,600~$47,150: 12%',
  },
  {
    name: 'Federal Income Tax — 22%',
    taxType: 'INCOME_TAX',
    bracketMin: 47_150,
    bracketMax: 100_525,
    rate: 0.22,
    fixedAmount: 0,
    description: '$47,150~$100,525: 22%',
  },
  {
    name: 'Federal Income Tax — 24%',
    taxType: 'INCOME_TAX',
    bracketMin: 100_525,
    bracketMax: 191_950,
    rate: 0.24,
    fixedAmount: 0,
    description: '$100,525~$191,950: 24%',
  },
  {
    name: 'Federal Income Tax — 32%',
    taxType: 'INCOME_TAX',
    bracketMin: 191_950,
    bracketMax: 243_725,
    rate: 0.32,
    fixedAmount: 0,
    description: '$191,950~$243,725: 32%',
  },
  {
    name: 'Federal Income Tax — 35%',
    taxType: 'INCOME_TAX',
    bracketMin: 243_725,
    bracketMax: 609_350,
    rate: 0.35,
    fixedAmount: 0,
    description: '$243,725~$609,350: 35%',
  },
  {
    name: 'Federal Income Tax — 37%',
    taxType: 'INCOME_TAX',
    bracketMin: 609_350,
    bracketMax: null,
    rate: 0.37,
    fixedAmount: 0,
    description: 'Over $609,350: 37%',
  },
]

// ─── FICA (Social Security + Medicare) ───────────────────

export const US_SOCIAL_INSURANCE: TaxBracketConfig[] = [
  {
    name: 'Social Security (OASDI)',
    taxType: 'SOCIAL_INSURANCE',
    bracketMin: 0,
    bracketMax: 168_600,
    rate: 0.062,
    fixedAmount: 0,
    description: 'Social Security 6.2% (wage base limit $168,600)',
  },
  {
    name: 'Medicare',
    taxType: 'HEALTH_INSURANCE',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.0145,
    fixedAmount: 0,
    description: 'Medicare 1.45% (no wage base limit)',
  },
  {
    name: 'Additional Medicare Tax',
    taxType: 'HEALTH_INSURANCE',
    bracketMin: 200_000,
    bracketMax: null,
    rate: 0.009,
    fixedAmount: 0,
    description: 'Additional Medicare 0.9% on wages over $200,000',
  },
]
