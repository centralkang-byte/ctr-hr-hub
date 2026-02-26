// ═══════════════════════════════════════════════════════════
// CTR HR Hub — China Labor Law Module (Stub)
// ═══════════════════════════════════════════════════════════

import type { LaborModule, WorkHoursValidation } from '@/lib/labor/index'

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
