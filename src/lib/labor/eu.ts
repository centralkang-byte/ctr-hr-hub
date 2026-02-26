// ═══════════════════════════════════════════════════════════
// CTR HR Hub — EU/Poland Labor Law Module (Stub)
// CTR Europe: 소재지 폴란드(PL), locale=en
// ═══════════════════════════════════════════════════════════

import type { LaborModule, WorkHoursValidation } from '@/lib/labor/index'

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
