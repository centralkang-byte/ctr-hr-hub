// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Vietnam Labor Law Module (Stub)
// ═══════════════════════════════════════════════════════════

import type { LaborModule, WorkHoursValidation } from '@/lib/labor/index'

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
