export type SettingType =
  | 'EVALUATION'
  | 'PROMOTION'
  | 'COMPENSATION'
  | 'ATTENDANCE'
  | 'LEAVE'
  | 'ONBOARDING'
  | 'RECRUITMENT'
  | 'BENEFITS'
  | 'PAYROLL'
  | 'SYSTEM'
  | 'PERFORMANCE'
  | 'ORGANIZATION'

// ── Per-setting-type JSONB schemas ──

export type EvaluationSettings = {
  grading_scale: 'S_A_B_C' | 'S_A_B_C_D' | 'A_B_C_D_E'
  forced_distribution: boolean
  distribution_rules?: { grade: string; min_pct: number; max_pct: number }[]
  review_sequence: ('SELF' | 'MANAGER' | 'PEER' | 'CALIBRATION')[]
  bei_enabled: boolean
  mbo_weight: number   // 0–100
  bei_weight: number   // 0–100; mbo_weight + bei_weight = 100
}

export type PromotionSettings = {
  min_tenure_by_grade: Record<string, number>   // e.g. { "G5": 3, "G4": 4 }
  requires_evaluation_grade?: string[]          // e.g. ["S", "A"]
  requires_consecutive_years?: number
  approval_chain: string[]                      // e.g. ["TEAM_LEAD", "HR_COMMITTEE"]
}

export type CompensationSettings = {
  salary_bands: { grade_code: string; min: number; max: number; currency: string }[]
  raise_matrix?: { eval_grade: string; band_position: 'LOW' | 'MID' | 'HIGH'; raise_pct: number }[]
  bonus_rules?: Record<string, unknown>
}

export type AttendanceSettings = {
  work_hours_per_day: number
  work_days_per_week: number
  weekly_hour_limit: number
  overtime_requires_approval: boolean
  shift_enabled: boolean
  shift_patterns?: { name: string; start: string; end: string }[]
}

export type LeaveSettings = {
  leave_types: { code: string; name: string; paid: boolean; default_days: number }[]
  accrual_rules: { tenure_years: number; annual_days: number }[]
  carryover_max_days: number
  carryover_expiry_months: number
}

export type OnboardingSettings = {
  probation_period_months: number
  checklist_template_id?: string
  required_documents: string[]
  buddy_assignment: boolean
}

export type RecruitmentSettings = {
  pipeline_stages: string[]
  approval_required: boolean
  approval_chain: string[]
  ai_screening_enabled: boolean
}

export type BenefitsSettings = {
  eligible_programs: string[]
  annual_budget_per_employee?: number
  currency: string
}

// ── Payroll settings (H-2c) ──

export type KrSocialInsuranceSettings = {
  pensionRate: number
  pensionCeiling: number
  healthRate: number
  longTermCareRate: number
  employmentRate: number
  effectiveYear: number
}

export type TaxBracketEntry = {
  min: number
  max: number
  rate: number
  deduction: number
}

export type CountryDeductionSettings = {
  rates: Record<string, number>
  taxBrackets?: Array<Record<string, number>>
  exemptAmount?: number
  effectiveYear: number
}

export type AnomalyThresholdSettings = {
  momChangePercent: number
  momAmountThreshold: number
  bandTolerancePercent: number
  monthlyOtLimitHours: number
  prorateMinRatio: number
  grossChangePercent: number
  overtimeBaseRatio: number
}

export type PayScheduleSettings = {
  payDay: number
  closingDay?: number
}

// ── Performance settings (H-2c) ──

export type CalibrationDistributionSettings = {
  enforced: boolean
  advisory: boolean
  deviationThreshold: number
  distribution: Record<string, { min: number; max: number; recommended: number }>
}

export type GradeScaleSettings = {
  scale: number
  grades: Array<{
    code: string
    label: string
    minScore: number
    maxScore: number
    color: string
  }>
}

// ── System settings (H-2c) ──

export type ExchangeRateSettings = {
  rates: Record<string, number>
  baseCurrency: string
  effectiveDate: string
}

export type DataRetentionSettings = {
  defaultRetentionDays: number
  piiMaskingEnabled: boolean
  auditLogRetentionDays: number
}

// ── Compensation settings (Phase 3) ──

export type CompaRatioThresholdsSettings = {
  bands: { label: string; maxRatio: number | null; attritionScore: number }[]
  belowBandThreshold: number  // merit matrix / analytics "below" boundary (default: 0.9)
  aboveBandThreshold: number  // merit matrix / analytics "above" boundary (default: 1.1)
}

// ── Organization settings (Phase 3) ──

export type ContractRulesSettings = {
  rules: Record<string, {
    max_fixed_term_count: number
    max_fixed_term_months: number
    auto_convert_to_permanent: boolean
    probation_range: { min_days: number; max_days: number }
  }>
}

export type WorkHourAlertThresholdsSettings = {
  caution: number
  warning: number
  blocked: number
}

// ── Organization settings (H-2d) ──

export type AssignmentRuleEntry = {
  code: string
  label: string
  desc: string
  requiresApproval: boolean
}

export type AssignmentRulesSetting = {
  rules: AssignmentRuleEntry[]
}

// ── Recruitment settings (H-2d) ──

export type PipelineStageEntry = {
  id: string
  name: string
  nameEn: string
  color: string
}

export type PipelineStageSetting = {
  stages: PipelineStageEntry[]
}

export type AiScreeningFeatureEntry = {
  key: string
  label: string
  desc: string
  enabled: boolean
}

export type AiScreeningSetting = {
  enabled: boolean
  minScore: number
  features: AiScreeningFeatureEntry[]
}

export type InterviewFormCategoryEntry = {
  category: string
  items: string[]
}

export type InterviewFormSetting = {
  categories: InterviewFormCategoryEntry[]
}

// ── System settings (H-2d) ──

export type LocaleSetting = {
  defaultLocale: string
  defaultTimezone: string
  supportedLocales: string[]
}

export type NotificationChannelEntry = {
  key: string
  label: string
  iconKey: string
  enabled: boolean
}

export type NotificationChannelsSetting = {
  channels: NotificationChannelEntry[]
}

export type ProcessSettingValue =
  | EvaluationSettings
  | PromotionSettings
  | CompensationSettings
  | AttendanceSettings
  | LeaveSettings
  | OnboardingSettings
  | RecruitmentSettings
  | BenefitsSettings
  | KrSocialInsuranceSettings
  | CountryDeductionSettings
  | AnomalyThresholdSettings
  | PayScheduleSettings
  | CalibrationDistributionSettings
  | GradeScaleSettings
  | ExchangeRateSettings
  | DataRetentionSettings
  | AssignmentRulesSetting
  | PipelineStageSetting
  | AiScreeningSetting
  | InterviewFormSetting
  | LocaleSetting
  | NotificationChannelsSetting
  | CompaRatioThresholdsSettings
  | ContractRulesSettings
  | WorkHourAlertThresholdsSettings
  | Record<string, unknown>

export type CompanyProcessSettingRow = {
  id: string
  companyId: string | null
  settingType: SettingType
  settingKey: string
  settingValue: ProcessSettingValue
  description: string | null
}
