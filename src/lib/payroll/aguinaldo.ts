// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Mexico Aguinaldo Calculator (LFT Art. 87)
// 15-day statutory year-end bonus, pro-rated for partial years
// Tax-exempt up to 30 × UMA daily (LISR Art. 93)
// ═══════════════════════════════════════════════════════════

import { getPayrollSetting } from '@/lib/settings/get-setting'

interface AguinaldoConfig {
    daysEntitled: number
    proportionalForPartialYear: boolean
    taxExemptDays: number
    umaDaily: number
}

const AGUINALDO_DEFAULTS: AguinaldoConfig = {
    daysEntitled: 15,
    proportionalForPartialYear: true,
    taxExemptDays: 30,
    umaDaily: 113.14,
}

export interface AguinaldoResult {
    grossAguinaldo: number
    taxExemptAmount: number
    taxableAmount: number
    daysEntitled: number
    proportionalDays: number
}

/**
 * Calculate Mexico Aguinaldo (year-end bonus) per LFT Art. 87.
 *
 * @param dailySalary     - Employee's daily integrated salary
 * @param daysWorkedInYear - Calendar days worked in the current year (max 365)
 * @param companyId       - Optional company ID for per-company override
 */
export async function calculateAguinaldo(
    dailySalary: number,
    daysWorkedInYear: number,
    companyId?: string | null,
): Promise<AguinaldoResult> {
    const config = await getPayrollSetting<AguinaldoConfig>(
        'aguinaldo-config', companyId,
    ) ?? AGUINALDO_DEFAULTS

    const clampedDays = Math.min(Math.max(0, daysWorkedInYear), 365)
    const proportionalDays = config.proportionalForPartialYear
        ? (clampedDays / 365) * config.daysEntitled
        : config.daysEntitled

    const grossAguinaldo = Math.round(dailySalary * proportionalDays)
    const taxExemptAmount = Math.round(
        (config.umaDaily ?? AGUINALDO_DEFAULTS.umaDaily) * config.taxExemptDays,
    )
    const taxableAmount = Math.max(0, grossAguinaldo - taxExemptAmount)

    return {
        grossAguinaldo,
        taxExemptAmount,
        taxableAmount,
        daysEntitled: config.daysEntitled,
        proportionalDays: Math.round(proportionalDays * 100) / 100,
    }
}
