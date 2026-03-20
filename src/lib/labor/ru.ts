// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Russia Labor Law Module (Stub)
// ═══════════════════════════════════════════════════════════

import type { LaborModule, WorkHoursValidation } from '@/lib/labor/index'
import type { LaborConfig } from '@/lib/labor/types'
import {
  getWorkHourLimitsFromSettings,
  getMinWageFromSettings,
  getOvertimeRatesFromSettings,
  getProbationRulesFromSettings,
} from '@/lib/labor/settings'
import type { ProbationRulesSettings } from '@/lib/labor/settings'
import type { OvertimeRate, NightShiftRule } from '@/lib/labor/types'

export const ruLaborModule: LaborModule = {
  countryCode: 'RU',
  locale: 'ru',
  currency: 'RUB',

  getOvertimeLimit(): number {
    return 40 // Art. 91 ТК РФ: 40h standard work week
  },

  getMinWage(): number {
    return 134.17 // MROT ₽22,440/month ÷ ~167h (RUB/hr, 2025)
  },

  validateWorkHours(weeklyHours: number): WorkHoursValidation {
    const maxWeeklyHours = 40 // Art. 91 ТК РФ
    return {
      isValid: weeklyHours <= maxWeeklyHours,
      weeklyHours,
      maxWeeklyHours,
    }
  },

  getAnnualLeaveEntitlement(_yearsOfService: number): number {
    return 28 // Russian Labor Code: minimum 28 calendar days
  },
}

// Russian Federation Labor Code (Трудовой кодекс РФ)
export const laborConfig: LaborConfig = {
  country_code: 'RU',
  standard_hours_weekly: 40,           // Art. 91 ТК РФ
  standard_hours_daily: 8,             // Art. 91: 40h / 5 days
  overtime_threshold_weekly: 40,
  max_overtime_weekly: 4,              // Art. 99: max 4h per 2 consecutive days
  overtime_rates: [
    { label: 'Russia Weekday OT (first 2h)', multiplier: 1.5, condition: 'WEEKDAY_OT' },
    { label: 'Russia Weekend/Holiday OT', multiplier: 2.0, condition: 'WEEKEND' },
    { label: 'Russia Holiday OT', multiplier: 2.0, condition: 'HOLIDAY' },
    { label: 'Russia Night Premium', multiplier: 1.2, condition: 'NIGHT' },
  ],
  leave_types: [
    { type: 'ANNUAL', days_per_year: 28, accrual_rule: 'FRONT_LOADED', paid: true },  // Art. 115: 28 calendar days
    { type: 'SICK', days_per_year: null, accrual_rule: 'FRONT_LOADED', paid: true },   // Covered by ФСС
  ],
  mandatory_break: [
    { threshold_minutes: 240, break_minutes: 30 },  // Art. 108: 30-120 min
  ],
  night_shift: { start_hour: 22, end_hour: 6 },     // Art. 96
  probation_months: 3,                               // Art. 70: up to 3 months
  severance: {
    description: '1 month average salary (redundancy, Art. 178)',
    calculate: (tenureYears: number, monthlyAvgSalary: number) =>
      Math.max(1, tenureYears) * monthlyAvgSalary,   // Minimum 1 month
  },
}

// ─── Settings-aware async config loader ───────────────────

export async function getRuLaborConfigFromSettings(
  companyId?: string | null,
): Promise<{
  maxWeeklyHours: number
  standardWeeklyHours: number
  maxOvertimeHours: number
  minHourlyWage: number
  overtimeRates: OvertimeRate[]
  nightShift: NightShiftRule
  probation: ProbationRulesSettings
}> {
  const [workHourLimits, wageConfig, otConfig, probation] = await Promise.all([
    getWorkHourLimitsFromSettings(companyId, 'RU'),
    getMinWageFromSettings(companyId, 'RU'),
    getOvertimeRatesFromSettings(companyId, 'RU'),
    getProbationRulesFromSettings(companyId, 'RU'),
  ])

  return {
    maxWeeklyHours: workHourLimits.maxWeeklyHours,
    standardWeeklyHours: workHourLimits.standardWeeklyHours,
    maxOvertimeHours: workHourLimits.maxOvertimeHours,
    minHourlyWage: wageConfig.hourlyWage,
    overtimeRates: otConfig.rates,
    nightShift: otConfig.nightShift,
    probation,
  }
}
