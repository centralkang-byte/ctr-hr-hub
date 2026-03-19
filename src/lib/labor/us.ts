// ═══════════════════════════════════════════════════════════
// CTR HR Hub — US Labor Law Module (Stub)
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

export const laborConfig: LaborConfig = {
  country_code: 'US',
  standard_hours_weekly: 40,
  standard_hours_daily: 8,
  overtime_threshold_weekly: 40,
  max_overtime_weekly: 20,
  overtime_rates: [
    { label: 'FLSA Overtime', multiplier: 1.5, condition: 'WEEKDAY_OT' },
  ],
  leave_types: [
    { type: 'SICK', days_per_year: 5, accrual_rule: 'FRONT_LOADED', paid: true },
    { type: 'PTO', days_per_year: 10, accrual_rule: 'FRONT_LOADED', paid: true },
  ],
  mandatory_break: [
    { threshold_minutes: 360, break_minutes: 30 },
  ],
  night_shift: { start_hour: 22, end_hour: 6 },
  probation_months: 3,
  severance: null,
}

export const usLaborModule: LaborModule = {
  countryCode: 'US',
  locale: 'en',
  currency: 'USD',

  getOvertimeLimit(): number {
    return 45 // FLSA: no hard weekly cap, using company policy
  },

  getMinWage(): number {
    return 7.25 // Federal minimum wage (USD/hr)
  },

  validateWorkHours(weeklyHours: number): WorkHoursValidation {
    const maxWeeklyHours = 45
    return {
      isValid: weeklyHours <= maxWeeklyHours,
      message: weeklyHours > 40 ? `Overtime: ${weeklyHours - 40} hours` : undefined,
      weeklyHours,
      maxWeeklyHours,
    }
  },

  getAnnualLeaveEntitlement(_yearsOfService: number): number {
    return 10 // Typical US PTO (no legal minimum)
  },
}

// ─── Settings-aware async config loader ───────────────────

export async function getUsLaborConfigFromSettings(
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
    getWorkHourLimitsFromSettings(companyId, 'US'),
    getMinWageFromSettings(companyId, 'US'),
    getOvertimeRatesFromSettings(companyId, 'US'),
    getProbationRulesFromSettings(companyId, 'US'),
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
