// Labor Law Engine — Common Types
// Each country file exports a LaborConfig implementing these interfaces

export interface LaborConfig {
  country_code: string
  standard_hours_weekly: number
  standard_hours_daily: number
  overtime_threshold_weekly: number
  max_overtime_weekly: number
  overtime_rates: OvertimeRate[]
  leave_types: LeaveTypeConfig[]
  mandatory_break: BreakRule[]
  night_shift: NightShiftRule
  probation_months: number
  severance: SeveranceRule | null
}

export interface OvertimeRate {
  label: string
  multiplier: number
  condition: 'WEEKDAY_OT' | 'WEEKEND' | 'HOLIDAY' | 'NIGHT' | 'FIRST_9H' | 'AFTER_9H'
}

export interface LeaveTypeConfig {
  type: string
  days_per_year: number | null
  accrual_rule: 'FRONT_LOADED' | 'MONTHLY_ACCRUAL' | 'TENURE_BASED'
  paid: boolean
}

export interface BreakRule {
  threshold_minutes: number
  break_minutes: number
}

export interface NightShiftRule {
  start_hour: number
  end_hour: number
}

export interface SeveranceRule {
  description: string
  calculate: (tenureYears: number, monthlyAvgSalary: number) => number
}

export interface OvertimeCalculation {
  regular_hours: number
  overtime_hours: number
  breakdown: OvertimeBreakdown[]
}

export interface OvertimeBreakdown {
  label: string
  hours: number
  multiplier: number
  pay_equivalent_hours: number
}

export interface LeaveAccrualResult {
  entitled_days: number
  rule_description: string
}
