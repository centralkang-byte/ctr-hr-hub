// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Seed: Labor & Contract Settings (Phase 3)
// Seeds hardcoded labor/contract/compensation values
// into CompanyProcessSetting (companyId: null = global default)
// ═══════════════════════════════════════════════════════════

import type { PrismaClient, Prisma } from '../../src/generated/prisma/client'

interface SettingDef {
  settingType: string
  settingKey: string
  settingValue: Prisma.InputJsonValue
  description: string
}

const SETTINGS: SettingDef[] = [
  // ─── COMPENSATION: Compa-Ratio Thresholds ─────────────────
  {
    settingType: 'COMPENSATION',
    settingKey: 'compa-ratio-thresholds',
    description: 'Compa-Ratio 밴드 임계값 + 이직위험 점수 + merit matrix 경계',
    settingValue: {
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
    },
  },
  // ─── ATTENDANCE: Work Hour Alert Thresholds ───────────────
  {
    settingType: 'ATTENDANCE',
    settingKey: 'work-hour-thresholds',
    description: '52시간 경고 단계별 임계값 (시간/주)',
    settingValue: {
      caution: 44,
      warning: 48,
      blocked: 52,
    },
  },
  // ─── ORGANIZATION: Contract Rules (7개국) ─────────────────
  {
    settingType: 'ORGANIZATION',
    settingKey: 'contract-rules',
    description: '국가별 기간제 계약 규칙 (횟수/기간/자동전환/수습)',
    settingValue: {
      rules: {
        KR: { max_fixed_term_count: 0, max_fixed_term_months: 24, auto_convert_to_permanent: true, probation_range: { min_days: 90, max_days: 90 } },
        CN: { max_fixed_term_count: 2, max_fixed_term_months: 0, auto_convert_to_permanent: true, probation_range: { min_days: 30, max_days: 180 } },
        RU: { max_fixed_term_count: 0, max_fixed_term_months: 60, auto_convert_to_permanent: false, probation_range: { min_days: 90, max_days: 180 } },
        VN: { max_fixed_term_count: 2, max_fixed_term_months: 72, auto_convert_to_permanent: true, probation_range: { min_days: 6, max_days: 180 } },
        MX: { max_fixed_term_count: 0, max_fixed_term_months: 0, auto_convert_to_permanent: false, probation_range: { min_days: 30, max_days: 180 } },
        US: { max_fixed_term_count: 0, max_fixed_term_months: 0, auto_convert_to_permanent: false, probation_range: { min_days: 90, max_days: 90 } },
        PL: { max_fixed_term_count: 3, max_fixed_term_months: 33, auto_convert_to_permanent: true, probation_range: { min_days: 0, max_days: 90 } },
      },
    },
  },
  // ─── ATTENDANCE: Work Hour Limits (8개국) ─────────────────
  {
    settingType: 'ATTENDANCE',
    settingKey: 'work-hour-limits',
    description: '국가별 표준/최대 근로시간 + 초과근무 한도 (시간/주)',
    settingValue: {
      KR: { standardWeeklyHours: 40, maxWeeklyHours: 52, maxOvertimeHours: 12 },
      CN: { standardWeeklyHours: 40, maxWeeklyHours: 44, maxOvertimeHours: 36 },
      US: { standardWeeklyHours: 40, maxWeeklyHours: 45, maxOvertimeHours: 20 },
      VN: { standardWeeklyHours: 48, maxWeeklyHours: 48, maxOvertimeHours: 12 },
      MX: { standardWeeklyHours: 48, maxWeeklyHours: 48, maxOvertimeHours: 9 },
      RU: { standardWeeklyHours: 40, maxWeeklyHours: 40, maxOvertimeHours: 4 },
      EU: { standardWeeklyHours: 40, maxWeeklyHours: 48, maxOvertimeHours: 8 },
      PL: { standardWeeklyHours: 40, maxWeeklyHours: 48, maxOvertimeHours: 8 },
    },
  },
  // ─── ATTENDANCE: Minimum Wage (8개국) ─────────────────────
  {
    settingType: 'ATTENDANCE',
    settingKey: 'min-wage',
    description: '국가별 최저시급 (2025년 기준)',
    settingValue: {
      KR: { hourlyWage: 10030, currency: 'KRW', effectiveYear: 2025 },
      CN: { hourlyWage: 25.3, currency: 'CNY', effectiveYear: 2025, note: 'Shanghai region' },
      US: { hourlyWage: 7.25, currency: 'USD', effectiveYear: 2024, note: 'Federal minimum' },
      VN: { hourlyWage: 22500, currency: 'VND', effectiveYear: 2024, note: 'Region I' },
      MX: { hourlyWage: 33.24, currency: 'MXN', effectiveYear: 2025 },
      RU: { hourlyWage: 134.17, currency: 'RUB', effectiveYear: 2025, note: 'Based on MROT' },
      EU: { hourlyWage: 28.1, currency: 'PLN', effectiveYear: 2025, note: 'Poland' },
      PL: { hourlyWage: 28.1, currency: 'PLN', effectiveYear: 2025, note: 'Poland' },
    },
  },
  // ─── ORGANIZATION: Probation Rules (8개국) ────────────────
  {
    settingType: 'ORGANIZATION',
    settingKey: 'probation-rules',
    description: '국가별 수습 기간 규칙',
    settingValue: {
      KR: { defaultMonths: 3, maxMonths: 3, leaveEligibleAfterMonths: 3, terminationNoticeDays: 30 },
      CN: { defaultMonths: 6, maxMonths: 6, leaveEligibleAfterMonths: 6, terminationNoticeDays: 3, extendable: false },
      US: { defaultMonths: 3, maxMonths: 3, leaveEligibleAfterMonths: 0, terminationNoticeDays: 0 },
      VN: { defaultMonths: 6, maxMonths: 6, leaveEligibleAfterMonths: 6, terminationNoticeDays: 3 },
      MX: { defaultMonths: 3, maxMonths: 3, leaveEligibleAfterMonths: 3, terminationNoticeDays: 15 },
      RU: { defaultMonths: 3, maxMonths: 3, leaveEligibleAfterMonths: 6, terminationNoticeDays: 3 },
      EU: { defaultMonths: 3, maxMonths: 3, leaveEligibleAfterMonths: 3, terminationNoticeDays: 14 },
      PL: { defaultMonths: 3, maxMonths: 3, leaveEligibleAfterMonths: 3, terminationNoticeDays: 14 },
    },
  },
  // ─── ATTENDANCE: Overtime Rules (8개국) ────────────────────
  {
    settingType: 'ATTENDANCE',
    settingKey: 'overtime-rules',
    description: '국가별 초과근무 배율 + 야간근무 시간대',
    settingValue: {
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
        rates: [{ label: 'FLSA Overtime', multiplier: 1.5, condition: 'WEEKDAY_OT' }],
        nightShift: { start_hour: 22, end_hour: 6 },
      },
      VN: {
        rates: [{ label: 'Vietnam OT', multiplier: 2.0, condition: 'WEEKDAY_OT' }],
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
    },
  },
]

export async function seedLaborContractSettings(p: PrismaClient) {
  console.log('  🔧 Seeding labor & contract settings defaults...')

  let created = 0
  let updated = 0

  for (const def of SETTINGS) {
    const existing = await p.companyProcessSetting.findFirst({
      where: {
        settingType: def.settingType,
        settingKey: def.settingKey,
        companyId: null,
      },
    })

    if (existing) {
      await p.companyProcessSetting.update({
        where: { id: existing.id },
        data: {
          settingValue: def.settingValue,
          description: def.description,
        },
      })
      updated++
    } else {
      await p.companyProcessSetting.create({
        data: {
          settingType: def.settingType,
          settingKey: def.settingKey,
          settingValue: def.settingValue,
          description: def.description,
          companyId: null,
        },
      })
      created++
    }
  }

  console.log(`    ✅ Labor/contract settings: ${created} created, ${updated} updated`)
}
