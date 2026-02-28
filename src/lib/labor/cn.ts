// ═══════════════════════════════════════════════════════════
// CTR HR Hub — China Labor Law Module (Stub)
// ═══════════════════════════════════════════════════════════

import type { LaborModule, WorkHoursValidation } from '@/lib/labor/index'
import type { LaborConfig } from '@/lib/labor/types'

export const laborConfig: LaborConfig = {
  country_code: 'CN',
  standard_hours_weekly: 40,
  standard_hours_daily: 8,
  overtime_threshold_weekly: 40,
  max_overtime_weekly: 36,
  overtime_rates: [
    { label: '工作日加班', multiplier: 1.5, condition: 'WEEKDAY_OT' },
    { label: '休息日加班', multiplier: 2.0, condition: 'WEEKEND' },
    { label: '法定节假日加班', multiplier: 3.0, condition: 'HOLIDAY' },
  ],
  leave_types: [
    { type: 'ANNUAL', days_per_year: 5, accrual_rule: 'TENURE_BASED', paid: true },
    { type: 'SICK', days_per_year: null, accrual_rule: 'TENURE_BASED', paid: true },
  ],
  mandatory_break: [
    { threshold_minutes: 240, break_minutes: 60 },
  ],
  night_shift: { start_hour: 22, end_hour: 6 },
  probation_months: 6,
  severance: {
    description: 'N+1 경제补偿金',
    calculate: (tenureYears, monthlyAvgSalary) => (tenureYears + 1) * monthlyAvgSalary,
  },
}

export const cnLaborModule: LaborModule = {
  countryCode: 'CN',
  locale: 'zh',
  currency: 'CNY',

  getOvertimeLimit(): number {
    return 44 // 기본 44h/주 + 월 36h 연장 제한
  },

  getMinWage(): number {
    return 25.3 // Shanghai 2024 (CNY/hr, varies by region)
  },

  validateWorkHours(weeklyHours: number): WorkHoursValidation {
    const maxWeeklyHours = 44
    return {
      isValid: weeklyHours <= maxWeeklyHours,
      weeklyHours,
      maxWeeklyHours,
    }
  },

  getAnnualLeaveEntitlement(yearsOfService: number): number {
    if (yearsOfService < 1) return 0
    if (yearsOfService < 10) return 5
    if (yearsOfService < 20) return 10
    return 15
  },
}
