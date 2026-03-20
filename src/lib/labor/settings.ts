// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Labor Settings (Generalized FromSettings)
// Reads work-hour-limits and min-wage from CompanyProcessSetting
// with country-specific hardcoded fallbacks.
// Pattern: company override → global default → hardcoded constant
// ═══════════════════════════════════════════════════════════

import { getAttendanceSetting, getOrganizationSetting } from '@/lib/settings/get-setting'
import type { OvertimeRate, NightShiftRule } from '@/lib/labor/types'

// ─── Work Hour Limits ────────────────────────────────────

export interface WorkHourLimitsSettings {
  maxWeeklyHours: number
  standardWeeklyHours: number
  maxOvertimeHours: number
}

const WORK_HOUR_DEFAULTS: Record<string, WorkHourLimitsSettings> = {
  KR: { standardWeeklyHours: 40, maxWeeklyHours: 52, maxOvertimeHours: 12 },
  CN: { standardWeeklyHours: 40, maxWeeklyHours: 44, maxOvertimeHours: 36 },
  US: { standardWeeklyHours: 40, maxWeeklyHours: 45, maxOvertimeHours: 20 },
  VN: { standardWeeklyHours: 48, maxWeeklyHours: 48, maxOvertimeHours: 12 },
  MX: { standardWeeklyHours: 48, maxWeeklyHours: 48, maxOvertimeHours: 9 },
  RU: { standardWeeklyHours: 40, maxWeeklyHours: 40, maxOvertimeHours: 4 },
  EU: { standardWeeklyHours: 40, maxWeeklyHours: 48, maxOvertimeHours: 8 },
  PL: { standardWeeklyHours: 40, maxWeeklyHours: 48, maxOvertimeHours: 8 },
}

/**
 * Async function that reads work hour limits from CompanyProcessSetting.
 * Falls back to hardcoded country-specific constants if not configured.
 */
export async function getWorkHourLimitsFromSettings(
  companyId?: string | null,
  countryCode?: string,
): Promise<WorkHourLimitsSettings> {
  const settings = await getAttendanceSetting<WorkHourLimitsSettings>(
    'work-hour-limits',
    companyId,
  )

  const code = countryCode?.toUpperCase() ?? 'KR'
  const defaults = WORK_HOUR_DEFAULTS[code] ?? WORK_HOUR_DEFAULTS.KR

  return {
    maxWeeklyHours: settings?.maxWeeklyHours ?? defaults.maxWeeklyHours,
    standardWeeklyHours: settings?.standardWeeklyHours ?? defaults.standardWeeklyHours,
    maxOvertimeHours: settings?.maxOvertimeHours ?? defaults.maxOvertimeHours,
  }
}

// ─── Minimum Wage ────────────────────────────────────────

export interface MinWageSettings {
  hourlyWage: number
  currency: string
  effectiveYear: number
  note?: string
}

const MIN_WAGE_DEFAULTS: Record<string, MinWageSettings> = {
  KR: { hourlyWage: 10030, currency: 'KRW', effectiveYear: 2025 },
  CN: { hourlyWage: 25.3, currency: 'CNY', effectiveYear: 2025, note: 'Shanghai region' },
  US: { hourlyWage: 7.25, currency: 'USD', effectiveYear: 2024, note: 'Federal minimum' },
  VN: { hourlyWage: 22500, currency: 'VND', effectiveYear: 2024, note: 'Region I' },
  MX: { hourlyWage: 33.24, currency: 'MXN', effectiveYear: 2025 },
  RU: { hourlyWage: 134.17, currency: 'RUB', effectiveYear: 2025, note: 'Based on MROT' },
  EU: { hourlyWage: 28.1, currency: 'PLN', effectiveYear: 2025, note: 'Poland' },
  PL: { hourlyWage: 28.1, currency: 'PLN', effectiveYear: 2025, note: 'Poland' },
}

/**
 * Async function that reads minimum wage from CompanyProcessSetting.
 * Falls back to hardcoded country-specific constants if not configured.
 */
export async function getMinWageFromSettings(
  companyId?: string | null,
  countryCode?: string,
): Promise<MinWageSettings> {
  const settings = await getAttendanceSetting<MinWageSettings>(
    'min-wage',
    companyId,
  )

  const code = countryCode?.toUpperCase() ?? 'KR'
  const defaults = MIN_WAGE_DEFAULTS[code] ?? MIN_WAGE_DEFAULTS.KR

  return {
    hourlyWage: settings?.hourlyWage ?? defaults.hourlyWage,
    currency: settings?.currency ?? defaults.currency,
    effectiveYear: settings?.effectiveYear ?? defaults.effectiveYear,
    note: settings?.note ?? defaults.note,
  }
}

// ─── Overtime Rates ─────────────────────────────────────

export interface OvertimeRateSettings {
  rates: OvertimeRate[]
  nightShift: NightShiftRule
}

/**
 * Default OT rates per country — extracted from laborConfig.overtime_rates.
 * Used as hardcoded fallback when no CompanyProcessSetting exists.
 */
const OT_RATE_DEFAULTS: Record<string, OvertimeRateSettings> = {
  KR: {
    rates: [
      { label: '연장근로 (평일)', multiplier: 1.5, condition: 'WEEKDAY_OT' },
      { label: '휴일근로', multiplier: 1.5, condition: 'WEEKEND' },
      { label: '공휴일근로', multiplier: 2.0, condition: 'HOLIDAY' },
      { label: '야간근로 가산', multiplier: 0.5, condition: 'NIGHT' },
    ],
    nightShift: { start_hour: 22, end_hour: 6 },
  },
  CN: {
    rates: [
      { label: '工作日加班', multiplier: 1.5, condition: 'WEEKDAY_OT' },
      { label: '休息日加班', multiplier: 2.0, condition: 'WEEKEND' },
      { label: '法定节假日加班', multiplier: 3.0, condition: 'HOLIDAY' },
    ],
    nightShift: { start_hour: 22, end_hour: 6 },
  },
  US: {
    rates: [
      { label: 'FLSA Overtime', multiplier: 1.5, condition: 'WEEKDAY_OT' },
    ],
    nightShift: { start_hour: 22, end_hour: 6 },
  },
  VN: {
    rates: [
      { label: 'Vietnam OT', multiplier: 2.0, condition: 'WEEKDAY_OT' },
    ],
    nightShift: { start_hour: 22, end_hour: 6 },
  },
  MX: {
    rates: [
      { label: 'First 9h', multiplier: 2.0, condition: 'FIRST_9H' },
      { label: 'After 9h', multiplier: 3.0, condition: 'AFTER_9H' },
    ],
    nightShift: { start_hour: 22, end_hour: 6 },
  },
  RU: {
    rates: [
      { label: 'Russia Weekday OT (first 2h)', multiplier: 1.5, condition: 'WEEKDAY_OT' },
      { label: 'Russia Weekend/Holiday OT', multiplier: 2.0, condition: 'WEEKEND' },
      { label: 'Russia Holiday OT', multiplier: 2.0, condition: 'HOLIDAY' },
      { label: 'Russia Night Premium', multiplier: 1.2, condition: 'NIGHT' },
    ],
    nightShift: { start_hour: 22, end_hour: 6 },
  },
  EU: {
    rates: [
      { label: 'Weekday OT', multiplier: 1.5, condition: 'WEEKDAY_OT' },
      { label: 'Weekend OT', multiplier: 2.0, condition: 'WEEKEND' },
    ],
    nightShift: { start_hour: 22, end_hour: 6 },
  },
  PL: {
    rates: [
      { label: 'Weekday OT', multiplier: 1.5, condition: 'WEEKDAY_OT' },
      { label: 'Weekend OT', multiplier: 2.0, condition: 'WEEKEND' },
    ],
    nightShift: { start_hour: 22, end_hour: 6 },
  },
}

/**
 * Reads overtime rates from CompanyProcessSetting (key: 'overtime-rules').
 * The DB stores a flat multipliers object; we reconstruct OvertimeRate[] from it.
 * Falls back to hardcoded country-specific constants if not configured.
 */
// ─── Probation Rules ─────────────────────────────────────

export interface ProbationRulesSettings {
  defaultMonths: number
  maxMonths?: number
  leaveEligibleAfterMonths?: number
  terminationNoticeDays?: number
  extendable?: boolean
}

const PROBATION_DEFAULTS: Record<string, ProbationRulesSettings> = {
  KR: { defaultMonths: 3, maxMonths: 3, leaveEligibleAfterMonths: 3, terminationNoticeDays: 30 },
  CN: { defaultMonths: 6, maxMonths: 6, leaveEligibleAfterMonths: 6, terminationNoticeDays: 3, extendable: false },
  US: { defaultMonths: 3, maxMonths: 3, leaveEligibleAfterMonths: 0, terminationNoticeDays: 0 },
  VN: { defaultMonths: 6, maxMonths: 6, leaveEligibleAfterMonths: 6, terminationNoticeDays: 3 },
  MX: { defaultMonths: 3, maxMonths: 3, leaveEligibleAfterMonths: 3, terminationNoticeDays: 15 },
  RU: { defaultMonths: 3, maxMonths: 3, leaveEligibleAfterMonths: 6, terminationNoticeDays: 3 },
  EU: { defaultMonths: 3, maxMonths: 3, leaveEligibleAfterMonths: 3, terminationNoticeDays: 14 },
  PL: { defaultMonths: 3, maxMonths: 3, leaveEligibleAfterMonths: 3, terminationNoticeDays: 14 },
}

/**
 * Reads probation rules from CompanyProcessSetting (key: 'probation-rules').
 * Falls back to hardcoded country-specific constants if not configured.
 */
export async function getProbationRulesFromSettings(
  companyId?: string | null,
  countryCode?: string,
): Promise<ProbationRulesSettings> {
  const settings = await getOrganizationSetting<ProbationRulesSettings>(
    'probation-rules',
    companyId,
  )

  const code = countryCode?.toUpperCase() ?? 'KR'
  const defaults = PROBATION_DEFAULTS[code] ?? PROBATION_DEFAULTS.KR

  if (!settings) return defaults

  return {
    defaultMonths: settings.defaultMonths ?? defaults.defaultMonths,
    maxMonths: settings.maxMonths ?? defaults.maxMonths,
    leaveEligibleAfterMonths: settings.leaveEligibleAfterMonths ?? defaults.leaveEligibleAfterMonths,
    terminationNoticeDays: settings.terminationNoticeDays ?? defaults.terminationNoticeDays,
    extendable: settings.extendable ?? defaults.extendable,
  }
}

// ─── Overtime Rates ─────────────────────────────────────

export async function getOvertimeRatesFromSettings(
  companyId?: string | null,
  countryCode?: string,
): Promise<OvertimeRateSettings> {
  const settings = await getAttendanceSetting<{
    multipliers?: { weekdayOt?: number; weekend?: number; holiday?: number; night?: number }
    nightStartHour?: number
    nightEndHour?: number
    rates?: OvertimeRate[]
  }>('overtime-rules', companyId)

  const code = countryCode?.toUpperCase() ?? 'KR'
  const defaults = OT_RATE_DEFAULTS[code] ?? OT_RATE_DEFAULTS.KR

  if (!settings) return defaults

  // If the DB has the full rates array, use it directly
  if (settings.rates && Array.isArray(settings.rates)) {
    return {
      rates: settings.rates,
      nightShift: {
        start_hour: settings.nightStartHour ?? defaults.nightShift.start_hour,
        end_hour: settings.nightEndHour ?? defaults.nightShift.end_hour,
      },
    }
  }

  // Otherwise reconstruct from flat multipliers object
  if (settings.multipliers) {
    const m = settings.multipliers
    const rates: OvertimeRate[] = []

    const weekdayRate = defaults.rates.find((r) => r.condition === 'WEEKDAY_OT' || r.condition === 'FIRST_9H')
    if (weekdayRate && m.weekdayOt !== undefined) {
      rates.push({ ...weekdayRate, multiplier: m.weekdayOt })
    }
    const weekendRate = defaults.rates.find((r) => r.condition === 'WEEKEND')
    if (weekendRate && m.weekend !== undefined) {
      rates.push({ ...weekendRate, multiplier: m.weekend })
    }
    const holidayRate = defaults.rates.find((r) => r.condition === 'HOLIDAY')
    if (holidayRate && m.holiday !== undefined) {
      rates.push({ ...holidayRate, multiplier: m.holiday })
    }
    const nightRate = defaults.rates.find((r) => r.condition === 'NIGHT')
    if (nightRate && m.night !== undefined) {
      rates.push({ ...nightRate, multiplier: m.night })
    }

    // For rates not in multipliers, keep defaults
    for (const dr of defaults.rates) {
      if (!rates.some((r) => r.condition === dr.condition)) {
        rates.push(dr)
      }
    }

    return {
      rates,
      nightShift: {
        start_hour: settings.nightStartHour ?? defaults.nightShift.start_hour,
        end_hour: settings.nightEndHour ?? defaults.nightShift.end_hour,
      },
    }
  }

  return defaults
}
