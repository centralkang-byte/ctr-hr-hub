// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Vietnam Labor Law Module (Stub)
// ═══════════════════════════════════════════════════════════

import type { LaborModule, WorkHoursValidation } from '@/lib/labor/index'
import type { LaborConfig } from '@/lib/labor/types'

export const vnLaborModule: LaborModule = {
  countryCode: 'VN',
  locale: 'vi',
  currency: 'VND',

  getOvertimeLimit(): number {
    return 48
  },

  getMinWage(): number {
    return 22500 // Region I (VND/hr, ~4,680,000/month)
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
    const base = 12
    const additional = Math.floor(yearsOfService / 5)
    return base + additional
  },
}

export const laborConfig: LaborConfig = {
  country_code: 'VN',
  standard_hours_weekly: 48,
  standard_hours_daily: 8,
  overtime_threshold_weekly: 48,
  max_overtime_weekly: 12,
  overtime_rates: [
    { label: 'India OT', multiplier: 2.0, condition: 'WEEKDAY_OT' },
  ],
  leave_types: [
    { type: 'CASUAL', days_per_year: 12, accrual_rule: 'FRONT_LOADED', paid: true },
    { type: 'SICK', days_per_year: 12, accrual_rule: 'FRONT_LOADED', paid: true },
    { type: 'EARNED', days_per_year: 15, accrual_rule: 'MONTHLY_ACCRUAL', paid: true },
  ],
  mandatory_break: [
    { threshold_minutes: 300, break_minutes: 30 },
  ],
  night_shift: { start_hour: 22, end_hour: 6 },
  probation_months: 6,
  severance: null,
}
