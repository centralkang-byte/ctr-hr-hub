// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Russia Tax Brackets (RU)
// ═══════════════════════════════════════════════════════════
// НДФЛ: 13% (15% свыше 5 млн руб.)
// Страховые взносы: ПФР, ОМС, ФСС

import type { TaxBracketConfig } from './index'

// ─── Income Tax (НДФЛ) ──────────────────────────────────

export const RU_TAX_BRACKETS: TaxBracketConfig[] = [
  {
    name: 'НДФЛ стандартная ставка',
    taxType: 'INCOME_TAX',
    bracketMin: 0,
    bracketMax: 5_000_000,
    rate: 0.13,
    fixedAmount: 0,
    description: 'Доход до 5 млн руб.: 13%',
  },
  {
    name: 'НДФЛ повышенная ставка',
    taxType: 'INCOME_TAX',
    bracketMin: 5_000_000,
    bracketMax: null,
    rate: 0.15,
    fixedAmount: 0,
    description: 'Доход свыше 5 млн руб.: 15%',
  },
]

// ─── Social Insurance (Страховые взносы — за сотрудника) ─
// Note: These are employer-paid but tracked for total cost

export const RU_SOCIAL_INSURANCE: TaxBracketConfig[] = [
  {
    name: 'Пенсионное страхование (ПФР)',
    taxType: 'PENSION',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.22,
    fixedAmount: 0,
    description: 'Пенсионные взносы 22% (10% свыше предела)',
  },
  {
    name: 'Медицинское страхование (ОМС)',
    taxType: 'HEALTH_INSURANCE',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.051,
    fixedAmount: 0,
    description: 'Обязательное медицинское страхование 5.1%',
  },
  {
    name: 'Социальное страхование (ФСС)',
    taxType: 'SOCIAL_INSURANCE',
    bracketMin: 0,
    bracketMax: null,
    rate: 0.029,
    fixedAmount: 0,
    description: 'Фонд социального страхования 2.9%',
  },
]
