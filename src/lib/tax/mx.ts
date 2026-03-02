// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Mexico Tax Brackets (MX)
// ═══════════════════════════════════════════════════════════
// ISR: Impuesto Sobre la Renta (1.92%~35%)
// IMSS: Instituto Mexicano del Seguro Social

import type { TaxBracketConfig } from './index'

// ─── Income Tax (ISR — Impuesto Sobre la Renta) ─────────
// Annual brackets (MXN), 2024 tariff table

export const MX_TAX_BRACKETS: TaxBracketConfig[] = [
  {
    name: 'ISR Rango 1',
    taxType: 'INCOME_TAX',
    bracketMin: 0,
    bracketMax: 8_952.49,
    rate: 0.0192,
    fixedAmount: 0,
    description: 'Hasta $8,952.49: 1.92%',
  },
  {
    name: 'ISR Rango 2',
    taxType: 'INCOME_TAX',
    bracketMin: 8_952.49,
    bracketMax: 75_984.55,
    rate: 0.0640,
    fixedAmount: 171.88,
    description: '$8,952.49~$75,984.55: 6.40% + cuota fija $171.88',
  },
  {
    name: 'ISR Rango 3',
    taxType: 'INCOME_TAX',
    bracketMin: 75_984.55,
    bracketMax: 133_536.07,
    rate: 0.1088,
    fixedAmount: 4_461.94,
    description: '$75,984.55~$133,536.07: 10.88% + cuota fija $4,461.94',
  },
  {
    name: 'ISR Rango 4',
    taxType: 'INCOME_TAX',
    bracketMin: 133_536.07,
    bracketMax: 155_229.80,
    rate: 0.16,
    fixedAmount: 10_723.55,
    description: '$133,536.07~$155,229.80: 16% + cuota fija $10,723.55',
  },
  {
    name: 'ISR Rango 5',
    taxType: 'INCOME_TAX',
    bracketMin: 155_229.80,
    bracketMax: 185_852.57,
    rate: 0.1792,
    fixedAmount: 14_194.54,
    description: '$155,229.80~$185,852.57: 17.92% + cuota fija $14,194.54',
  },
  {
    name: 'ISR Rango 6',
    taxType: 'INCOME_TAX',
    bracketMin: 185_852.57,
    bracketMax: 374_837.88,
    rate: 0.2136,
    fixedAmount: 19_682.13,
    description: '$185,852.57~$374,837.88: 21.36% + cuota fija $19,682.13',
  },
  {
    name: 'ISR Rango 7',
    taxType: 'INCOME_TAX',
    bracketMin: 374_837.88,
    bracketMax: 590_795.99,
    rate: 0.2352,
    fixedAmount: 60_049.40,
    description: '$374,837.88~$590,795.99: 23.52% + cuota fija $60,049.40',
  },
  {
    name: 'ISR Rango 8',
    taxType: 'INCOME_TAX',
    bracketMin: 590_795.99,
    bracketMax: 1_127_926.84,
    rate: 0.30,
    fixedAmount: 110_842.74,
    description: '$590,795.99~$1,127,926.84: 30% + cuota fija $110,842.74',
  },
  {
    name: 'ISR Rango 9',
    taxType: 'INCOME_TAX',
    bracketMin: 1_127_926.84,
    bracketMax: 1_503_902.46,
    rate: 0.32,
    fixedAmount: 271_981.99,
    description: '$1,127,926.84~$1,503,902.46: 32% + cuota fija $271,981.99',
  },
  {
    name: 'ISR Rango 10',
    taxType: 'INCOME_TAX',
    bracketMin: 1_503_902.46,
    bracketMax: 4_511_707.37,
    rate: 0.34,
    fixedAmount: 392_294.17,
    description: '$1,503,902.46~$4,511,707.37: 34% + cuota fija $392,294.17',
  },
  {
    name: 'ISR Rango 11',
    taxType: 'INCOME_TAX',
    bracketMin: 4_511_707.37,
    bracketMax: null,
    rate: 0.35,
    fixedAmount: 1_414_947.85,
    description: 'Más de $4,511,707.37: 35% + cuota fija $1,414,947.85',
  },
]

// ─── Social Insurance (IMSS — cuotas del trabajador) ─────

export const MX_SOCIAL_INSURANCE: TaxBracketConfig[] = [
  {
    name: 'IMSS — Enfermedad y Maternidad',
    taxType: 'HEALTH_INSURANCE',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.00625,
    fixedAmount: 0,
    description: 'Seguro de enfermedad y maternidad 0.625%',
  },
  {
    name: 'IMSS — Invalidez y Vida',
    taxType: 'SOCIAL_INSURANCE',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.00625,
    fixedAmount: 0,
    description: 'Seguro de invalidez y vida 0.625%',
  },
  {
    name: 'IMSS — Cesantía y Vejez',
    taxType: 'PENSION',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.01125,
    fixedAmount: 0,
    description: 'Seguro de cesantía en edad avanzada y vejez 1.125%',
  },
  {
    name: 'IMSS — Retiro (SAR)',
    taxType: 'PENSION',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.02,
    fixedAmount: 0,
    description: 'Aportación al retiro (SAR) 2% (patrón)',
  },
]
