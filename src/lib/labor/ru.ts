// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Russia Labor Law Module (Stub)
// ═══════════════════════════════════════════════════════════

import type { LaborModule, WorkHoursValidation } from '@/lib/labor/index'

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
