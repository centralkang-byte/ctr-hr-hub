// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Labor Module (Country-specific labor laws)
// ═══════════════════════════════════════════════════════════

import { krLaborModule, laborConfig as krConfig } from '@/lib/labor/kr'
import { usLaborModule, laborConfig as usConfig } from '@/lib/labor/us'
import { cnLaborModule, laborConfig as cnConfig } from '@/lib/labor/cn'
import { ruLaborModule, laborConfig as ruConfig } from '@/lib/labor/ru'
import { vnLaborModule, laborConfig as vnConfig } from '@/lib/labor/vn'
import { euLaborModule, laborConfig as euConfig } from '@/lib/labor/eu'
import { mxLaborModule, laborConfig as mxConfig } from '@/lib/labor/mx'
import type {
  LaborConfig,
  OvertimeCalculation,
  LeaveAccrualResult,
  BreakRule,
} from '@/lib/labor/types'

// ─── Labor Module Interface ──────────────────────────────

export interface WorkHoursValidation {
  isValid: boolean
  message?: string
  weeklyHours: number
  maxWeeklyHours: number
}

export interface LaborModule {
  countryCode: string
  locale: string
  currency: string

  /** 주당 최대 근무시간 (연장 포함) */
  getOvertimeLimit(): number

  /** 최저시급 (현지 통화 기준) */
  getMinWage(): number

  /** 근무시간 유효성 검사 */
  validateWorkHours(weeklyHours: number): WorkHoursValidation

  /** 법정 연차 일수 (근속연수 기준) */
  getAnnualLeaveEntitlement(yearsOfService: number): number
}

// ─── Country Module Registry ─────────────────────────────

const laborModules: Record<string, LaborModule> = {
  KR: krLaborModule,
  US: usLaborModule,
  CN: cnLaborModule,
  RU: ruLaborModule,
  VN: vnLaborModule,
  PL: euLaborModule,  // CTR Europe is in Poland
  EU: euLaborModule,
  MX: mxLaborModule,
}

export function getLaborModule(countryCode: string): LaborModule {
  return laborModules[countryCode.toUpperCase()] ?? krLaborModule
}

// ─── LaborConfig Registry ────────────────────────────────

const laborConfigs: Record<string, LaborConfig> = {
  KR: krConfig,
  US: usConfig,
  CN: cnConfig,
  RU: ruConfig,
  VN: vnConfig,
  PL: euConfig,
  EU: euConfig,
  MX: mxConfig,
}

export function getLaborConfig(countryCode: string): LaborConfig {
  return laborConfigs[countryCode.toUpperCase()] ?? krConfig
}

// ─── Calculation Functions ───────────────────────────────

/** 주간 근무시간 → 정규/초과 분리 + 초과근무 내역 */
export function calculateOvertime(
  config: LaborConfig,
  weeklyHours: number,
): OvertimeCalculation {
  const regularHours = Math.min(weeklyHours, config.overtime_threshold_weekly)
  const overtimeHours = Math.max(0, weeklyHours - config.overtime_threshold_weekly)

  const breakdown = config.overtime_rates
    .filter((r) => r.condition === 'WEEKDAY_OT')
    .map((rate) => ({
      label: rate.label,
      hours: overtimeHours,
      multiplier: rate.multiplier,
      pay_equivalent_hours: overtimeHours * rate.multiplier,
    }))

  return { regular_hours: regularHours, overtime_hours: overtimeHours, breakdown }
}

/** 근속연수 기반 연차 부여일수 산출 */
export function calculateLeaveAccrual(
  config: LaborConfig,
  yearsOfService: number,
): LeaveAccrualResult {
  const annualLeave = config.leave_types.find((l) => l.type === 'ANNUAL')
  if (!annualLeave || annualLeave.days_per_year === null) {
    return { entitled_days: 0, rule_description: 'No annual leave config' }
  }

  if (annualLeave.accrual_rule === 'TENURE_BASED') {
    // 한국식: 15일 기본 + 2년마다 1일 추가 (최대 25일)
    if (config.country_code === 'KR') {
      if (yearsOfService < 1) return { entitled_days: 11, rule_description: '1년 미만: 월 1일' }
      const base = 15
      const additional = Math.floor((yearsOfService - 1) / 2)
      return {
        entitled_days: Math.min(base + additional, 25),
        rule_description: `${base} + ${additional}일 (근속 ${yearsOfService}년)`,
      }
    }
    // 기타: 기본일수에 근속연수 비례 가산
    const base = annualLeave.days_per_year
    const additional = Math.floor(yearsOfService / 5)
    return {
      entitled_days: base + additional,
      rule_description: `${base} + ${additional}일 (근속 ${yearsOfService}년)`,
    }
  }

  return {
    entitled_days: annualLeave.days_per_year,
    rule_description: `${annualLeave.accrual_rule}: ${annualLeave.days_per_year}일`,
  }
}

/** 근무시간에 따른 법정 휴게시간 */
export function getMandatoryBreak(config: LaborConfig, workMinutes: number): BreakRule | null {
  // 근무시간 이상인 규칙 중 가장 큰 threshold 적용
  const applicable = config.mandatory_break
    .filter((r) => workMinutes >= r.threshold_minutes)
    .sort((a, b) => b.threshold_minutes - a.threshold_minutes)

  return applicable[0] ?? null
}

export {
  krLaborModule,
  usLaborModule,
  cnLaborModule,
  ruLaborModule,
  vnLaborModule,
  euLaborModule,
  mxLaborModule,
}
