// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Korean Labor Law Module
// 근로기준법 기준
// ═══════════════════════════════════════════════════════════

import type { LaborModule, WorkHoursValidation } from '@/lib/labor/index'

const MAX_WEEKLY_HOURS = 52        // 주 52시간 (기본 40 + 연장 12)
const STANDARD_WEEKLY_HOURS = 40
const MAX_OVERTIME_HOURS = 12
const MIN_HOURLY_WAGE = 10030      // 2025년 최저시급 (KRW)

export const krLaborModule: LaborModule = {
  countryCode: 'KR',
  locale: 'ko',
  currency: 'KRW',

  getOvertimeLimit(): number {
    return MAX_WEEKLY_HOURS
  },

  getMinWage(): number {
    return MIN_HOURLY_WAGE
  },

  validateWorkHours(weeklyHours: number): WorkHoursValidation {
    const isValid = weeklyHours <= MAX_WEEKLY_HOURS

    let message: string | undefined
    if (weeklyHours > MAX_WEEKLY_HOURS) {
      message = `주 ${MAX_WEEKLY_HOURS}시간을 초과했습니다. (현재: ${weeklyHours}시간)`
    } else if (weeklyHours > STANDARD_WEEKLY_HOURS + MAX_OVERTIME_HOURS * 0.8) {
      message = `주 52시간 초과 임박 (현재: ${weeklyHours}시간)`
    }

    return {
      isValid,
      message,
      weeklyHours,
      maxWeeklyHours: MAX_WEEKLY_HOURS,
    }
  },

  getAnnualLeaveEntitlement(yearsOfService: number): number {
    // 근로기준법 제60조: 1년 미만 → 월 1일, 1년 이상 → 15일
    // 3년 이상 → 매 2년마다 1일 추가 (최대 25일)
    if (yearsOfService < 1) return 11 // 월 1일 (11개월)
    const base = 15
    const additional = Math.floor((yearsOfService - 1) / 2)
    return Math.min(base + additional, 25)
  },
}
