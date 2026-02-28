// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Mexico Labor Law Module (Stub)
// ═══════════════════════════════════════════════════════════

import type { LaborModule, WorkHoursValidation } from '@/lib/labor/index'
import type { LaborConfig } from '@/lib/labor/types'

export const mxLaborModule: LaborModule = {
  countryCode: 'MX',
  locale: 'es',
  currency: 'MXN',

  getOvertimeLimit(): number {
    return 48
  },

  getMinWage(): number {
    return 33.24 // 2024 MXN/hr (~248.93/day)
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
    // Mexico Federal Labor Law (2023 reform)
    if (yearsOfService < 1) return 12
    if (yearsOfService <= 5) return 12 + (yearsOfService - 1) * 2
    return Math.min(20 + Math.floor((yearsOfService - 5) / 5) * 2, 32)
  },
}

export const laborConfig: LaborConfig = {
  country_code: 'MX',
  standard_hours_weekly: 48,
  standard_hours_daily: 8,
  overtime_threshold_weekly: 48,
  max_overtime_weekly: 9,
  overtime_rates: [
    { label: 'First 9h', multiplier: 2.0, condition: 'FIRST_9H' },
    { label: 'After 9h', multiplier: 3.0, condition: 'AFTER_9H' },
  ],
  leave_types: [
    { type: 'ANNUAL', days_per_year: 12, accrual_rule: 'TENURE_BASED', paid: true },
  ],
  mandatory_break: [
    { threshold_minutes: 360, break_minutes: 30 },
  ],
  night_shift: { start_hour: 22, end_hour: 6 },
  probation_months: 3,
  severance: {
    description: '3 months salary + 20 days per year of tenure',
    calculate: (tenureYears: number, monthlyAvgSalary: number) =>
      (3 * monthlyAvgSalary) + (tenureYears * monthlyAvgSalary * 20 / 30),
  },
}
