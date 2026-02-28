// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Russia Labor Law Module (Stub)
// ═══════════════════════════════════════════════════════════

import type { LaborModule, WorkHoursValidation } from '@/lib/labor/index'
import type { LaborConfig } from '@/lib/labor/types'

export const ruLaborModule: LaborModule = {
  countryCode: 'RU',
  locale: 'ru',
  currency: 'RUB',

  getOvertimeLimit(): number {
    return 45
  },

  getMinWage(): number {
    return 134.17 // ~19,242 RUB/month ÷ 143.3h (RUB/hr)
  },

  validateWorkHours(weeklyHours: number): WorkHoursValidation {
    const maxWeeklyHours = 45
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

export const laborConfig: LaborConfig = {
  country_code: 'TR',
  standard_hours_weekly: 45,
  standard_hours_daily: 7.5,
  overtime_threshold_weekly: 45,
  max_overtime_weekly: 11,
  overtime_rates: [
    { label: 'Turkey OT', multiplier: 1.5, condition: 'WEEKDAY_OT' },
  ],
  leave_types: [
    { type: 'ANNUAL', days_per_year: 14, accrual_rule: 'TENURE_BASED', paid: true },
  ],
  mandatory_break: [
    { threshold_minutes: 450, break_minutes: 60 },
  ],
  night_shift: { start_hour: 20, end_hour: 6 },
  probation_months: 2,
  severance: {
    description: '1 month salary per year of tenure',
    calculate: (tenureYears: number, monthlyAvgSalary: number) =>
      tenureYears * monthlyAvgSalary,
  },
}
