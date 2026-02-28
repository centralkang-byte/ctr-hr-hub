// ═══════════════════════════════════════════════════════════
// CTR HR Hub — EU/Poland Labor Law Module (Stub)
// CTR Europe: 소재지 폴란드(PL), locale=en
// ═══════════════════════════════════════════════════════════

import type { LaborModule, WorkHoursValidation } from '@/lib/labor/index'
import type { LaborConfig } from '@/lib/labor/types'

export const euLaborModule: LaborModule = {
  countryCode: 'PL',
  locale: 'en',
  currency: 'PLN',

  getOvertimeLimit(): number {
    return 48 // EU Working Time Directive: max 48h/week avg
  },

  getMinWage(): number {
    return 28.1 // Poland 2024: ~4,300 PLN/month ÷ 153h (PLN/hr)
  },

  validateWorkHours(weeklyHours: number): WorkHoursValidation {
    const maxWeeklyHours = 48
    return {
      isValid: weeklyHours <= maxWeeklyHours,
      weeklyHours,
      maxWeeklyHours,
    }
  },

  getAnnualLeaveEntitlement(yearsOfService: number): number {
    // Poland: 20 days (<10 years), 26 days (10+ years)
    return yearsOfService >= 10 ? 26 : 20
  },
}

export const laborConfig: LaborConfig = {
  country_code: 'EU',
  standard_hours_weekly: 40,
  standard_hours_daily: 8,
  overtime_threshold_weekly: 40,
  max_overtime_weekly: 8,
  overtime_rates: [
    { label: 'Weekday OT', multiplier: 1.5, condition: 'WEEKDAY_OT' },
    { label: 'Weekend OT', multiplier: 2.0, condition: 'WEEKEND' },
  ],
  leave_types: [
    { type: 'ANNUAL', days_per_year: 20, accrual_rule: 'TENURE_BASED', paid: true },
    { type: 'SICK', days_per_year: null, accrual_rule: 'FRONT_LOADED', paid: true },
  ],
  mandatory_break: [
    { threshold_minutes: 360, break_minutes: 15 },
  ],
  night_shift: { start_hour: 22, end_hour: 6 },
  probation_months: 3,
  severance: null,
}
