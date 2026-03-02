// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Vietnam Tax Brackets (VN)
// ═══════════════════════════════════════════════════════════
// Thuế TNCN: 7 bậc lũy tiến (5%~35%)
// Bảo hiểm: BHXH 8%, BHYT 1.5%, BHTN 1%

import type { TaxBracketConfig } from './index'

// ─── Income Tax (Thuế thu nhập cá nhân) ──────────────────
// Monthly taxable income brackets (VND)

export const VN_TAX_BRACKETS: TaxBracketConfig[] = [
  {
    name: 'Thuế TNCN bậc 1',
    taxType: 'INCOME_TAX',
    bracketMin: 0,
    bracketMax: 60_000_000,
    rate: 0.05,
    fixedAmount: 0,
    description: 'Thu nhập ≤ 60 triệu/năm: 5%',
  },
  {
    name: 'Thuế TNCN bậc 2',
    taxType: 'INCOME_TAX',
    bracketMin: 60_000_000,
    bracketMax: 120_000_000,
    rate: 0.10,
    fixedAmount: 0,
    description: '60~120 triệu/năm: 10%',
  },
  {
    name: 'Thuế TNCN bậc 3',
    taxType: 'INCOME_TAX',
    bracketMin: 120_000_000,
    bracketMax: 216_000_000,
    rate: 0.15,
    fixedAmount: 0,
    description: '120~216 triệu/năm: 15%',
  },
  {
    name: 'Thuế TNCN bậc 4',
    taxType: 'INCOME_TAX',
    bracketMin: 216_000_000,
    bracketMax: 384_000_000,
    rate: 0.20,
    fixedAmount: 0,
    description: '216~384 triệu/năm: 20%',
  },
  {
    name: 'Thuế TNCN bậc 5',
    taxType: 'INCOME_TAX',
    bracketMin: 384_000_000,
    bracketMax: 624_000_000,
    rate: 0.25,
    fixedAmount: 0,
    description: '384~624 triệu/năm: 25%',
  },
  {
    name: 'Thuế TNCN bậc 6',
    taxType: 'INCOME_TAX',
    bracketMin: 624_000_000,
    bracketMax: 960_000_000,
    rate: 0.30,
    fixedAmount: 0,
    description: '624~960 triệu/năm: 30%',
  },
  {
    name: 'Thuế TNCN bậc 7',
    taxType: 'INCOME_TAX',
    bracketMin: 960_000_000,
    bracketMax: null,
    rate: 0.35,
    fixedAmount: 0,
    description: '960 triệu/năm trở lên: 35%',
  },
]

// ─── Social Insurance (Bảo hiểm — phần người lao động) ───

export const VN_SOCIAL_INSURANCE: TaxBracketConfig[] = [
  {
    name: 'Bảo hiểm xã hội (BHXH)',
    taxType: 'SOCIAL_INSURANCE',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.08,
    fixedAmount: 0,
    description: 'BHXH người lao động đóng 8%',
  },
  {
    name: 'Bảo hiểm y tế (BHYT)',
    taxType: 'HEALTH_INSURANCE',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.015,
    fixedAmount: 0,
    description: 'BHYT người lao động đóng 1.5%',
  },
  {
    name: 'Bảo hiểm thất nghiệp (BHTN)',
    taxType: 'SOCIAL_INSURANCE',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.01,
    fixedAmount: 0,
    description: 'BHTN người lao động đóng 1%',
  },
]
