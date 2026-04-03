/**
 * CTR HR Hub — Settings Value Accessor with Request Memoization
 *
 * Wraps the CompanyProcessSetting lookup in React's `cache()` for
 * per-request deduplication. When multiple lib functions request
 * the same setting during a single API route handler, only ONE
 * database query is executed.
 *
 * Usage:
 *   const rates = await getSettingValue<KrSocialInsurance>('PAYROLL', 'kr-social-insurance', companyId)
 *   const pensionRate = rates?.pensionRate ?? 0.045  // always ?? not ||
 */
import { cache } from 'react'
import { prisma } from '@/lib/prisma'

/**
 * Fetches a single setting value, with company→global fallback.
 * Wrapped in `cache()` for per-request deduplication (Next.js App Router).
 */
export const getSettingValue = cache(async function <T = Record<string, unknown>>(
  settingType: string,
  settingKey: string,
  companyId?: string | null,
): Promise<T | null> {
  // Try company-specific first
  if (companyId) {
    const override = await prisma.companyProcessSetting.findFirst({
      where: { settingType, settingKey, companyId },
    })
    if (override) return override.settingValue as T
  }

  // Fall back to global default
  const global = await prisma.companyProcessSetting.findFirst({
    where: { settingType, settingKey, companyId: null },
  })

  return global ? (global.settingValue as T) : null
})

/**
 * Type-safe shorthand for specific categories
 */
export async function getPayrollSetting<T = Record<string, unknown>>(
  key: string,
  companyId?: string | null,
): Promise<T | null> {
  return getSettingValue<T>('PAYROLL', key, companyId)
}

export async function getAttendanceSetting<T = Record<string, unknown>>(
  key: string,
  companyId?: string | null,
): Promise<T | null> {
  return getSettingValue<T>('ATTENDANCE', key, companyId)
}

export async function getPerformanceSetting<T = Record<string, unknown>>(
  key: string,
  companyId?: string | null,
): Promise<T | null> {
  return getSettingValue<T>('PERFORMANCE', key, companyId)
}

export async function getSystemSetting<T = Record<string, unknown>>(
  key: string,
  companyId?: string | null,
): Promise<T | null> {
  return getSettingValue<T>('SYSTEM', key, companyId)
}

export async function getOrganizationSetting<T = Record<string, unknown>>(
  key: string,
  companyId?: string | null,
): Promise<T | null> {
  return getSettingValue<T>('ORGANIZATION', key, companyId)
}

export async function getCompensationSetting<T = Record<string, unknown>>(
  key: string,
  companyId?: string | null,
): Promise<T | null> {
  return getSettingValue<T>('COMPENSATION', key, companyId)
}

// ─── Compa-Ratio Thresholds (Phase 3) ───────────────────────

import type { CompaRatioThresholdsSettings, ContractRulesSettings } from '@/types/process-settings'

const DEFAULT_COMPA_THRESHOLDS: CompaRatioThresholdsSettings = {
  bands: [
    { label: 'VERY_LOW', maxRatio: 0.80, attritionScore: 90 },
    { label: 'LOW', maxRatio: 0.90, attritionScore: 70 },
    { label: 'BELOW_RANGE', maxRatio: 0.95, attritionScore: 50 },
    { label: 'AT_RANGE', maxRatio: 1.05, attritionScore: 20 },
    { label: 'HIGH', maxRatio: 1.20, attritionScore: 10 },
    { label: 'VERY_HIGH', maxRatio: null, attritionScore: 5 },
  ],
  belowBandThreshold: 0.9,
  aboveBandThreshold: 1.1,
}

export async function getCompaRatioThresholds(
  companyId?: string | null,
): Promise<CompaRatioThresholdsSettings> {
  const val = await getCompensationSetting<CompaRatioThresholdsSettings>('compa-ratio-thresholds', companyId)
  return val ?? DEFAULT_COMPA_THRESHOLDS
}

// ─── Contract Rules (Phase 3) ───────────────────────────────

const DEFAULT_CONTRACT_RULES: ContractRulesSettings['rules'] = {
  KR: { max_fixed_term_count: 0, max_fixed_term_months: 24, auto_convert_to_permanent: true, probation_range: { min_days: 90, max_days: 90 } },
  CN: { max_fixed_term_count: 2, max_fixed_term_months: 0, auto_convert_to_permanent: true, probation_range: { min_days: 30, max_days: 180 } },
  RU: { max_fixed_term_count: 0, max_fixed_term_months: 60, auto_convert_to_permanent: false, probation_range: { min_days: 90, max_days: 180 } },
  VN: { max_fixed_term_count: 2, max_fixed_term_months: 72, auto_convert_to_permanent: true, probation_range: { min_days: 6, max_days: 180 } },
  MX: { max_fixed_term_count: 0, max_fixed_term_months: 0, auto_convert_to_permanent: false, probation_range: { min_days: 30, max_days: 180 } },
  US: { max_fixed_term_count: 0, max_fixed_term_months: 0, auto_convert_to_permanent: false, probation_range: { min_days: 90, max_days: 90 } },
  PL: { max_fixed_term_count: 3, max_fixed_term_months: 33, auto_convert_to_permanent: true, probation_range: { min_days: 0, max_days: 90 } },
}

export async function getContractRulesFromSettings(
  companyId?: string | null,
  countryCode?: string,
): Promise<ContractRulesSettings['rules'][string]> {
  const val = await getOrganizationSetting<ContractRulesSettings>('contract-rules', companyId)
  const code = countryCode?.toUpperCase() ?? 'KR'
  const rules = val?.rules ?? DEFAULT_CONTRACT_RULES
  return rules[code] ?? DEFAULT_CONTRACT_RULES['KR']
}

// ─── System Threshold Helpers (S-Fix-5) ─────────────────────

/** Nudge rule timing thresholds (SYSTEM/nudge-rules) */
export interface NudgeRuleConfig {
  triggerAfterDays: number
  repeatEveryDays: number
  maxNudges: number
}

export interface NudgeRulesSettings {
  leavePending: NudgeRuleConfig
  payrollReview: NudgeRuleConfig
}

const NUDGE_DEFAULTS: NudgeRulesSettings = {
  leavePending: { triggerAfterDays: 3, repeatEveryDays: 2, maxNudges: 3 },
  payrollReview: { triggerAfterDays: 1, repeatEveryDays: 1, maxNudges: 5 },
}

export async function getNudgeRulesSettings(companyId?: string | null): Promise<NudgeRulesSettings> {
  const val = await getSystemSetting<NudgeRulesSettings>('nudge-rules', companyId)
  return val ?? NUDGE_DEFAULTS
}

/** Pending action priority & expiry alert thresholds (SYSTEM/alert-thresholds) */
export interface AlertThresholdsSettings {
  priority: {
    urgentDays: number
    highPriorityDays: number
  }
  contractExpiryAlertDays: number
  workPermitExpiryAlertDays: number
}

const ALERT_DEFAULTS: AlertThresholdsSettings = {
  priority: { urgentDays: 1, highPriorityDays: 3 },
  contractExpiryAlertDays: 30,
  workPermitExpiryAlertDays: 60,
}

export async function getAlertThresholdsSettings(companyId?: string | null): Promise<AlertThresholdsSettings> {
  const val = await getSystemSetting<AlertThresholdsSettings>('alert-thresholds', companyId)
  return val ?? ALERT_DEFAULTS
}

/** Analytics predictive model score boundaries (SYSTEM/analytics-thresholds) */
export interface AnalyticsThresholdsSettings {
  turnoverRisk: {
    criticalScore: number
    highScore: number
    mediumScore: number
  }
  teamHealth: {
    criticalScore: number
    highScore: number
    mediumScore: number
  }
}

const ANALYTICS_DEFAULTS: AnalyticsThresholdsSettings = {
  turnoverRisk: { criticalScore: 75, highScore: 55, mediumScore: 35 },
  teamHealth: { criticalScore: 70, highScore: 50, mediumScore: 30 },
}

export async function getAnalyticsThresholdsSettings(companyId?: string | null): Promise<AnalyticsThresholdsSettings> {
  const val = await getSystemSetting<AnalyticsThresholdsSettings>('analytics-thresholds', companyId)
  return val ?? ANALYTICS_DEFAULTS
}

// ─── Session Config (S-Fix-6) ────────────────────────────────

/** Session timeout configuration (SYSTEM/session-config) */
export interface SessionConfigSettings {
  maxAgeMinutes: number
  idleTimeoutMinutes: number
  extendOnActivity: boolean
}

const SESSION_CONFIG_DEFAULTS: SessionConfigSettings = {
  maxAgeMinutes: 480,          // 8 hours (enterprise standard)
  idleTimeoutMinutes: 30,      // 30 minutes idle
  extendOnActivity: true,
}

/**
 * Get session timeout configuration.
 * Note: NextAuth's maxAge is set statically at server startup (8h).
 * Changing maxAgeMinutes requires a server restart.
 * idleTimeoutMinutes can be consumed by a client-side idle detector.
 */
export async function getSessionConfigSettings(companyId?: string | null): Promise<SessionConfigSettings> {
  const val = await getSystemSetting<SessionConfigSettings>('session-config', companyId)
  return val ?? SESSION_CONFIG_DEFAULTS
}
