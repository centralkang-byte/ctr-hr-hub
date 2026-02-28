// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Korean Labor Law Module
// 근로기준법 기준
// ═══════════════════════════════════════════════════════════

import type { LaborModule, WorkHoursValidation } from '@/lib/labor/index'
import type { LaborConfig } from '@/lib/labor/types'

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

export const laborConfig: LaborConfig = {
  country_code: 'KR',
  standard_hours_weekly: 40,
  standard_hours_daily: 8,
  overtime_threshold_weekly: 40,
  max_overtime_weekly: 12,
  overtime_rates: [
    { label: '연장근로 (평일)', multiplier: 1.5, condition: 'WEEKDAY_OT' },
    { label: '휴일근로', multiplier: 1.5, condition: 'WEEKEND' },
    { label: '공휴일근로', multiplier: 2.0, condition: 'HOLIDAY' },
    { label: '야간근로 가산', multiplier: 0.5, condition: 'NIGHT' },
  ],
  leave_types: [
    { type: 'ANNUAL', days_per_year: 15, accrual_rule: 'TENURE_BASED', paid: true },
    { type: 'SICK', days_per_year: null, accrual_rule: 'FRONT_LOADED', paid: false },
    { type: 'MATERNITY', days_per_year: 90, accrual_rule: 'FRONT_LOADED', paid: true },
    { type: 'PATERNITY', days_per_year: 10, accrual_rule: 'FRONT_LOADED', paid: true },
    { type: 'FAMILY_CARE', days_per_year: 10, accrual_rule: 'FRONT_LOADED', paid: false },
    { type: 'WEDDING', days_per_year: 5, accrual_rule: 'FRONT_LOADED', paid: true },
    { type: 'BEREAVEMENT', days_per_year: 5, accrual_rule: 'FRONT_LOADED', paid: true },
    { type: 'MENSTRUAL', days_per_year: 12, accrual_rule: 'MONTHLY_ACCRUAL', paid: false },
  ],
  mandatory_break: [
    { threshold_minutes: 240, break_minutes: 30 },
    { threshold_minutes: 480, break_minutes: 60 },
  ],
  night_shift: { start_hour: 22, end_hour: 6 },
  probation_months: 3,
  severance: {
    description: '1년 이상 근무 시 30일분 평균임금',
    calculate: (tenureYears, monthlyAvgSalary) => tenureYears * monthlyAvgSalary,
  },
}

// 연차 사용 촉진 (근로기준법 제61조) — STEP 2.5
export const KR_LEAVE_PROMOTION = {
  enabled: true,
  steps: [
    {
      step: 1,
      trigger: 'ANNIVERSARY_MINUS_2M',
      action: 'NOTIFY_EMPLOYEE',
      message_key: 'LEAVE_PROMOTION_STEP1',
    },
    {
      step: 2,
      trigger: 'ANNIVERSARY_MINUS_1M',
      action: 'REQUEST_SCHEDULE',
      message_key: 'LEAVE_PROMOTION_STEP2',
    },
    {
      step: 3,
      trigger: 'ANNIVERSARY_MINUS_10D',
      action: 'EMPLOYER_DESIGNATE',
      message_key: 'LEAVE_PROMOTION_STEP3',
    },
  ],
  // 3단계 모두 이행 시 → 미사용 연차 수당 지급 의무 면제
  exemption_on_completion: true,
} as const

export const KR_LEAVE_PROMOTION_EVENTS = [
  'LEAVE_PROMOTION_STEP1',
  'LEAVE_PROMOTION_STEP2',
  'LEAVE_PROMOTION_STEP3',
] as const
