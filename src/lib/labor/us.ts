// ═══════════════════════════════════════════════════════════
// CTR HR Hub — US Labor Law Module (Stub)
// ═══════════════════════════════════════════════════════════

import type { LaborModule, WorkHoursValidation } from '@/lib/labor/index'

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
