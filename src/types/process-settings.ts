export type SettingType = 'evaluation' | 'attendance' | 'leave' | 'payroll' | 'recruitment'

export type EvaluationCycleSetting = { type: 'ANNUAL' | 'SEMI_ANNUAL'; months: number[] }
export type EvaluationWeightSetting = { weight: number }
export type OvertimeSetting = { hoursPerWeek: number; alertAt: number; legalMax?: number }
export type WorkModesSetting = { allowed: string[] }
export type AnnualDaysSetting = { days: number; accrual: 'MONTHLY' | 'UPFRONT'; lawMinimum?: number }
export type CarryOverSetting = { days: number }
export type PayDaySetting = { dayOfMonth: number }
export type ApprovalFlowSetting = { steps: string[] }

export type ProcessSettingValue =
  | EvaluationCycleSetting
  | EvaluationWeightSetting
  | OvertimeSetting
  | WorkModesSetting
  | AnnualDaysSetting
  | CarryOverSetting
  | PayDaySetting
  | ApprovalFlowSetting
  | Record<string, unknown>

export type CompanyProcessSettingRow = {
  id: string
  companyId: string | null
  settingType: SettingType
  settingKey: string
  settingValue: ProcessSettingValue
  description: string | null
}
