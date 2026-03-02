// ═══════════════════════════════════════════════════════════
// CTR HR Hub — International Tax Brackets (Index)
// ═══════════════════════════════════════════════════════════

import { KR_TAX_BRACKETS, KR_SOCIAL_INSURANCE } from './kr'
import { CN_TAX_BRACKETS, CN_SOCIAL_INSURANCE } from './cn'
import { RU_TAX_BRACKETS, RU_SOCIAL_INSURANCE } from './ru'
import { VN_TAX_BRACKETS, VN_SOCIAL_INSURANCE } from './vn'
import { MX_TAX_BRACKETS, MX_SOCIAL_INSURANCE } from './mx'
import { US_TAX_BRACKETS, US_SOCIAL_INSURANCE } from './us'
import { PL_TAX_BRACKETS, PL_SOCIAL_INSURANCE } from './pl'

// ─── Types ───────────────────────────────────────────────

export interface TaxBracketConfig {
  name: string
  taxType: 'INCOME_TAX' | 'LOCAL_TAX' | 'SOCIAL_INSURANCE' | 'PENSION' | 'HEALTH_INSURANCE' | 'OTHER'
  bracketMin: number
  bracketMax: number | null
  rate: number  // as decimal, e.g. 0.06 for 6%
  fixedAmount: number
  description?: string
}

// ─── Country Registry ────────────────────────────────────

export const TAX_COUNTRY_MAP: Record<string, TaxBracketConfig[]> = {
  KR: [...KR_TAX_BRACKETS, ...KR_SOCIAL_INSURANCE],
  CN: [...CN_TAX_BRACKETS, ...CN_SOCIAL_INSURANCE],
  RU: [...RU_TAX_BRACKETS, ...RU_SOCIAL_INSURANCE],
  VN: [...VN_TAX_BRACKETS, ...VN_SOCIAL_INSURANCE],
  MX: [...MX_TAX_BRACKETS, ...MX_SOCIAL_INSURANCE],
  US: [...US_TAX_BRACKETS, ...US_SOCIAL_INSURANCE],
  PL: [...PL_TAX_BRACKETS, ...PL_SOCIAL_INSURANCE],
}

export const SUPPORTED_TAX_COUNTRIES = Object.keys(TAX_COUNTRY_MAP)

// ─── Tax Calculation Helper ──────────────────────────────

/**
 * Calculate progressive tax for given brackets and income.
 * Brackets must be sorted by bracketMin ascending.
 * Each bracket applies its rate only to the portion of income within [bracketMin, bracketMax].
 */
export function calculateTax(brackets: TaxBracketConfig[], income: number): number {
  if (income <= 0) return 0

  let totalTax = 0

  for (const bracket of brackets) {
    if (income <= bracket.bracketMin) break

    const upper = bracket.bracketMax !== null
      ? Math.min(income, bracket.bracketMax)
      : income

    const taxableInBracket = upper - bracket.bracketMin

    if (taxableInBracket > 0) {
      totalTax += taxableInBracket * bracket.rate + bracket.fixedAmount
    }
  }

  return Math.round(totalTax)
}

// ─── Re-exports ──────────────────────────────────────────

export { KR_TAX_BRACKETS, KR_SOCIAL_INSURANCE } from './kr'
export { CN_TAX_BRACKETS, CN_SOCIAL_INSURANCE } from './cn'
export { RU_TAX_BRACKETS, RU_SOCIAL_INSURANCE } from './ru'
export { VN_TAX_BRACKETS, VN_SOCIAL_INSURANCE } from './vn'
export { MX_TAX_BRACKETS, MX_SOCIAL_INSURANCE } from './mx'
export { US_TAX_BRACKETS, US_SOCIAL_INSURANCE } from './us'
export { PL_TAX_BRACKETS, PL_SOCIAL_INSURANCE } from './pl'
