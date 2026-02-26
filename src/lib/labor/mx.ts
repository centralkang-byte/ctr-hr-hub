// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Mexico Labor Law Module (Stub)
// ═══════════════════════════════════════════════════════════

import type { LaborModule, WorkHoursValidation } from '@/lib/labor/index'

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
