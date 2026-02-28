// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Analytics Types
// MV 결과 인터페이스 + 대시보드 KPI 타입
// ═══════════════════════════════════════════════════════════

// ─── MV Result Types ─────────────────────────────────────

export interface HeadcountRow {
  snapshot_date: Date
  company_id: string
  department_id: string
  employment_type: string
  job_category_id: string | null
  headcount: number
  new_hires_30d: number
  resignations_30d: number
}

export interface AttendanceWeeklyRow {
  employee_id: string
  week_start: Date
  total_minutes: number
  overtime_minutes: number
  total_hours: number
  overtime_hours: number
  late_count: number
  absent_count: number
  early_out_count: number
  work_days: number
}

export interface PerformanceSummaryRow {
  cycle_id: string
  department_id: string
  ems_block: string
  employee_count: number
  avg_performance_score: number
  avg_competency_score: number
}

export interface RecruitmentFunnelRow {
  posting_id: string
  company_id: string
  posting_title: string
  stage: string
  candidate_count: number
  avg_screening_score: number | null
}

export interface BurnoutRiskRow {
  employee_id: string
  name: string
  company_id: string
  department: string
  job_category_code: string
  consecutive_high_weeks: number
  unused_days: number
  days_since_last_one_on_one: number
  is_burnout_warning: boolean
  is_burnout_critical: boolean
}

export interface TeamHealthRow {
  department_id: string
  department_name: string
  company_id: string
  team_size: number
  avg_performance_score: number | null
  avg_competency_score: number | null
  avg_late_count_4w: number | null
  avg_overtime_hours_4w: number | null
  avg_unused_leave_days: number | null
  one_on_one_coverage_pct: number | null
}

export interface ExitReasonMonthlyRow {
  month: Date
  resign_type: string
  primary_reason: string | null
  company_id: string
  count: number
}

export interface CompaRatioRow {
  company_id: string
  job_category_code: string
  grade_code: string
  grade_name: string
  employee_count: number
  avg_compa_ratio: number | null
  p25: number | null
  median: number | null
  p75: number | null
}

// ─── Dashboard KPI Types ────────────────────────────────

export interface OverviewKpi {
  totalHeadcount: number
  newHires30d: number
  resignations30d: number
  turnoverRateAnnualized: number
  avgOvertimeHours: number
  burnoutRiskCount: number
}

export interface WorkforceData {
  byDepartment: { department_id: string; department_name: string; headcount: number }[]
  byEmploymentType: { employment_type: string; headcount: number }[]
  byGrade: { grade_code: string; grade_name: string; headcount: number }[]
}

export interface TurnoverData {
  monthlyTrend: { month: string; resignations: number; turnover_rate: number }[]
  byReason: { reason: string; count: number }[]
  byDepartment: { department_name: string; turnover_rate: number; resignations: number }[]
  byResignType: { resign_type: string; count: number }[]
}

export interface PerformanceData {
  emsDistribution: { ems_block: string; employee_count: number }[]
  byDepartment: { department_name: string; avg_score: number }[]
  gradeDistribution: { grade: string; count: number }[]
}

export interface AttendanceData {
  weeklyTrend: { week_start: string; avg_total_hours: number; avg_overtime_hours: number }[]
  overtimeByDept: { department_name: string; avg_overtime_hours: number }[]
  issuesTrend: { week_start: string; late_count: number; absent_count: number; early_out_count: number }[]
  over52hCount: number
}

export interface RecruitmentData {
  funnel: { stage: string; candidate_count: number }[]
  conversionByPosting: { posting_id: string; posting_title: string; stage: string; candidate_count: number; avg_screening_score: number | null }[]
  avgHiringDays: number | null
}

export interface CompensationData {
  distribution: CompaRatioRow[]
  byGrade: { grade_code: string; grade_name: string; avg_compa_ratio: number }[]
  bandFit: { under: number; in_band: number; over: number }
}

export interface TeamHealthData {
  teams: TeamHealthRow[]
  burnoutList: BurnoutRiskRow[]
}

export interface ExecutiveReport {
  content: string
  generatedAt: string
  companyId: string | null
}
