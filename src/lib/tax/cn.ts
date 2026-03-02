// ═══════════════════════════════════════════════════════════
// CTR HR Hub — China Tax Brackets (CN)
// ═══════════════════════════════════════════════════════════
// 个人所得税: 7级超额累进税率 (3%~45%)
// 社会保险: 养老、医疗、失业、工伤、生育

import type { TaxBracketConfig } from './index'

// ─── Income Tax (个人所得税) ─────────────────────────────
// Monthly taxable income after standard deduction of 5,000 CNY

export const CN_TAX_BRACKETS: TaxBracketConfig[] = [
  {
    name: '个税 第1级',
    taxType: 'INCOME_TAX',
    bracketMin: 0,
    bracketMax: 36_000,
    rate: 0.03,
    fixedAmount: 0,
    description: '年应纳税所得额 ≤ 36,000: 3%',
  },
  {
    name: '个税 第2级',
    taxType: 'INCOME_TAX',
    bracketMin: 36_000,
    bracketMax: 144_000,
    rate: 0.10,
    fixedAmount: 0,
    description: '36,000~144,000: 10%',
  },
  {
    name: '个税 第3级',
    taxType: 'INCOME_TAX',
    bracketMin: 144_000,
    bracketMax: 300_000,
    rate: 0.20,
    fixedAmount: 0,
    description: '144,000~300,000: 20%',
  },
  {
    name: '个税 第4级',
    taxType: 'INCOME_TAX',
    bracketMin: 300_000,
    bracketMax: 420_000,
    rate: 0.25,
    fixedAmount: 0,
    description: '300,000~420,000: 25%',
  },
  {
    name: '个税 第5级',
    taxType: 'INCOME_TAX',
    bracketMin: 420_000,
    bracketMax: 660_000,
    rate: 0.30,
    fixedAmount: 0,
    description: '420,000~660,000: 30%',
  },
  {
    name: '个税 第6级',
    taxType: 'INCOME_TAX',
    bracketMin: 660_000,
    bracketMax: 960_000,
    rate: 0.35,
    fixedAmount: 0,
    description: '660,000~960,000: 35%',
  },
  {
    name: '个税 第7级',
    taxType: 'INCOME_TAX',
    bracketMin: 960_000,
    bracketMax: null,
    rate: 0.45,
    fixedAmount: 0,
    description: '960,000 以上: 45%',
  },
]

// ─── Social Insurance (社会保险 — 个人缴纳部分) ──────────
// Rates vary by city; these are typical Beijing/Shanghai rates

export const CN_SOCIAL_INSURANCE: TaxBracketConfig[] = [
  {
    name: '养老保险',
    taxType: 'PENSION',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.08,
    fixedAmount: 0,
    description: '养老保险个人缴纳 8%',
  },
  {
    name: '医疗保险',
    taxType: 'HEALTH_INSURANCE',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.02,
    fixedAmount: 0,
    description: '医疗保险个人缴纳 2%',
  },
  {
    name: '失业保险',
    taxType: 'SOCIAL_INSURANCE',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.005,
    fixedAmount: 0,
    description: '失业保险个人缴纳 0.5%',
  },
  {
    name: '住房公积金',
    taxType: 'OTHER',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.12,
    fixedAmount: 0,
    description: '住房公积金个人缴纳 12% (varies 5-12%)',
  },
]
