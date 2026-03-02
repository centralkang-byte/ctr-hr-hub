// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Poland Tax Brackets (PL)
// ═══════════════════════════════════════════════════════════
// PIT: 12% / 32% (próg podatkowy)
// ZUS: składki społeczne i zdrowotne

import type { TaxBracketConfig } from './index'

// ─── Income Tax (PIT — Podatek dochodowy) ────────────────
// Annual brackets (PLN), 2024

export const PL_TAX_BRACKETS: TaxBracketConfig[] = [
  {
    name: 'PIT — stawka 12%',
    taxType: 'INCOME_TAX',
    bracketMin: 0,
    bracketMax: 120_000,
    rate: 0.12,
    fixedAmount: 0,
    description: 'Dochód do 120,000 PLN: 12%',
  },
  {
    name: 'PIT — stawka 32%',
    taxType: 'INCOME_TAX',
    bracketMin: 120_000,
    bracketMax: null,
    rate: 0.32,
    fixedAmount: 0,
    description: 'Dochód powyżej 120,000 PLN: 32%',
  },
]

// ─── Social Insurance (ZUS — składki pracownika) ─────────

export const PL_SOCIAL_INSURANCE: TaxBracketConfig[] = [
  {
    name: 'Ubezpieczenie emerytalne',
    taxType: 'PENSION',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.0976,
    fixedAmount: 0,
    description: 'Składka emerytalna pracownika 9.76%',
  },
  {
    name: 'Ubezpieczenie rentowe',
    taxType: 'PENSION',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.015,
    fixedAmount: 0,
    description: 'Składka rentowa pracownika 1.5%',
  },
  {
    name: 'Ubezpieczenie chorobowe',
    taxType: 'SOCIAL_INSURANCE',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.0245,
    fixedAmount: 0,
    description: 'Składka chorobowa pracownika 2.45%',
  },
  {
    name: 'Ubezpieczenie zdrowotne',
    taxType: 'HEALTH_INSURANCE',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.09,
    fixedAmount: 0,
    description: 'Składka zdrowotna 9%',
  },
]
