// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Analytics Response Types (G-1)
// Shared contract: 7 dashboard APIs + UI components
// ═══════════════════════════════════════════════════════════

export interface KpiCard {
  label: string
  value: number | string
  unit?: string
  change?: number
  changeLabel?: string
  severity?: 'positive' | 'negative' | 'neutral'
}

export interface MonthlyDataPoint {
  month: string
  value: number
}

// --- 1. Executive Summary ---
export interface ExecutiveSummaryResponse {
  kpis: {
    totalEmployees: KpiCard
    monthlyTurnoverRate: KpiCard
    avgTenureYears: KpiCard
    monthlyLaborCost: KpiCard
    recruitmentPipeline: KpiCard
    onboardingCompletionRate: KpiCard
  }
  charts: {
    headcountTrend: { month: string; hires: number; exits: number; net: number }[]
    turnoverTrend: { month: string; rate: number }[]
    companyDistribution: { company: string; count: number; percentage: number }[]
  }
  riskAlerts: { type: string; count: number; severity: 'HIGH' | 'MEDIUM' | 'LOW'; link: string }[]
  companyComparison: {
    companyId: string
    companyName: string
    headcount: number
    turnoverRate: number
    avgTenure: number
    laborCost: string
    laborCostKRW: number
    onboardingInProgress: number
  }[]
  // Phase 2-A: Heatmap + Funnel
  departmentTurnoverHeatmap?: HeatmapDataPoint[]
  recruitmentFunnel?: RecruitmentFunnelStage[]
}

// --- 1-A. KPI Drilldown (Phase 2-A) ---
export type KpiDrilldownType = 'headcount' | 'turnover' | 'tenure' | 'laborCost' | 'recruitment' | 'onboarding'

export interface KpiDrilldownData {
  kpiType: KpiDrilldownType
  currentValue: number | string
  unit?: string
  change?: number
  benchmark?: { label: string; value: number }
  companyBreakdown: {
    companyId: string
    companyName: string
    value: number
    subValue?: string
  }[]
  monthlyTrend: { month: string; value: number }[]
  details?: {
    tenureDistribution?: { range: string; count: number }[]
    totalHires?: number
    totalExits?: number
    totalApplications?: number
    byStage?: Record<string, number>
    completedCount?: number
    totalCount?: number
    completionRate?: number
  }
}

export interface HeatmapDataPoint {
  department: string
  month: string
  turnoverRate: number
  headcount: number
}

export interface RecruitmentFunnelStage {
  stage: string
  count: number
  conversionRate?: number
}

// --- 2. Workforce ---
export interface WorkforceResponse {
  kpis: {
    totalEmployees: KpiCard
    newHires: KpiCard
    exits: KpiCard
    avgAge: KpiCard
  }
  charts: {
    positionLevelDist: { level: string; count: number }[]
    companyHeadcountTrend: { month: string; [companyName: string]: number | string }[]
    departmentDist: { department: string; count: number }[]
    tenureDist: { range: string; count: number }[]
    monthlyHiresExits: { month: string; hires: number; exits: number }[]
  }
}

// --- 3. Payroll ---
export interface PayrollResponse {
  kpis: {
    monthlyTotal: KpiCard
    changeRate: KpiCard
    perCapita: KpiCard
    anomalyCount: KpiCard
  }
  charts: {
    monthlyTrend: { month: string; baseSalary: number; allowances: number; total: number }[]
    companyComparison: { company: string; amountKRW: number; originalAmount: string }[]
    compositionRatio: { month: string; basePct: number; allowancePct: number; deductionPct: number }[]
  }
  currency: string
}

// --- 4. Performance ---
export interface PerformanceResponse {
  kpis: {
    currentCyclePhase: KpiCard
    evaluationCompletionRate: KpiCard
    calibrationAdjustmentRate: KpiCard
    goalSubmissionRate: KpiCard
  }
  charts: {
    gradeDistribution: { grade: string; actual: number; guideline: number }[]
    departmentGradeDist: { department: string; [grade: string]: number | string }[]
    evaluationProgress: { stage: string; completed: number; total: number }[]
  }
}

// --- 5. Attendance ---
export interface AttendanceResponse {
  kpis: {
    leaveUsageRate: KpiCard
    weeklyOvertimeViolations: KpiCard
    avgOvertimeHours: KpiCard
    negativeBalanceCount: KpiCard
  }
  charts: {
    overtimeTrend: { month: string; avgMinutes: number }[]
    violationTrend: { month: string; count: number }[]
    departmentLeaveUsage: { department: string; usageRate: number }[]
    weekdayPattern: { day: string; hour: number; count: number }[]
  }
}

// AttendanceData: shape returned by /api/v1/analytics/attendance
export interface AttendanceData {
  over52hCount: number
  weeklyTrend: {
    week_start: string
    avg_total_hours: number
    avg_overtime_hours: number
  }[]
  overtimeByDept: {
    department_name: string
    avg_overtime_hours: number
  }[]
  issuesTrend: {
    week_start: string
    late_count: number
    absent_count: number
    early_out_count: number
  }[]
}


// --- 6. Turnover ---
export interface TurnoverResponse {
  kpis: {
    monthlyTurnoverRate: KpiCard
    annualCumulativeRate: KpiCard
    regrettableTurnoverRate: KpiCard
    avgTenureAtExit: KpiCard
    highRiskPrediction: KpiCard
  }
  charts: {
    turnoverTrend: { month: string; rate: number }[]
    exitReasons: { reason: string; count: number; percentage: number }[]
    departmentTurnover: { department: string; rate: number }[]
    tenureAtExitDist: { range: string; count: number }[]
  }
  exitInterviewStats: {
    canDisplay: boolean
    totalCount: number
    reasonBreakdown?: { reason: string; percentage: number }[]
    satisfactionTrend?: { period: string; score: number }[]
    wouldRejoinRate?: number
    insufficientDepartments?: string[]
  }
  benchmarkRate: number
}

// --- 7. Team Health ---
export interface TeamHealthResponse {
  isEmpty: boolean
  score: number
  scoreLevel: 'HEALTHY' | 'CAUTION' | 'WARNING' | 'CRITICAL'
  subScores: {
    overtime: { score: number; level: string }
    leaveUsage: { score: number; level: string }
    performanceDist: { score: number; level: string }
    turnoverRisk: { score: number; level: string }
    burnoutRisk: { score: number; level: string }
  }
  members: {
    employeeId: string
    name: string
    weeklyOvertime: number
    leaveUsageRate: number
    lastGrade: string
    turnoverRisk: 'HIGH' | 'MEDIUM' | 'LOW'
    overallStatus: 'GREEN' | 'YELLOW' | 'RED'
  }[]
  recommendations: {
    severity: 'RED' | 'YELLOW'
    employeeName: string
    factors: string[]
    actionText: string
    actionLink?: string
  }[]
}

// ─── Materialized View Row Types (used by queries.ts) ────

export interface HeadcountRow {
  company_id: string
  department_id: string
  headcount: number
  new_hires_30d: number
  resignations_30d: number
}

export interface AttendanceWeeklyRow {
  employee_id: string
  week_start: Date
  total_hours: number
  overtime_hours: number
  late_count: number
  absent_count: number
  early_out_count: number
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
  avg_performance_score: number
  avg_competency_score: number
  avg_late_count_4w: number
  avg_overtime_hours_4w: number
  avg_unused_leave_days: number
  one_on_one_coverage_pct: number
}

export interface ExitReasonMonthlyRow {
  month: Date
  resign_type: string
  primary_reason: string
  company_id: string
  count: number
}

export interface CompaRatioRow {
  company_id: string
  job_category_code: string
  grade_code: string
  grade_name: string
  employee_count: number
  avg_compa_ratio: number
  p25: number
  median: number
  p75: number
}


export interface ExecutiveReport {
  content: string
  generatedAt: string
  companyId: string | null
}

// ─── API Route Data Types ────────────────────────────────

export interface OverviewKpi {
  totalHeadcount: number
  newHires30d: number
  resignations30d: number
  turnoverRateAnnualized: number
  avgOvertimeHours: number
  burnoutRiskCount: number
}

export interface CompensationData {
  distribution: unknown[]
  byGrade: { grade_code: string; grade_name: string; avg_compa_ratio: number }[]
  bandFit: { under: number; in_band: number; over: number }
}

export interface PerformanceData {
  emsDistribution: { ems_block: string; employee_count: number }[]
  byDepartment: { department_name: string; avg_score: number }[]
  gradeDistribution: unknown[]
}

export interface RecruitmentData {
  funnel: { stage: string; candidate_count: number }[]
  conversionByPosting: {
    posting_id: string
    posting_title: string
    stage: string
    candidate_count: number
    avg_screening_score: number | null
  }[]
  avgHiringDays: number | null
}

export interface TeamHealthData {
  teams: unknown[]
  burnoutList: unknown[]
}

export interface TurnoverData {
  monthlyTrend: { month: string; resignations: number; turnover_rate: number }[]
  byReason: { reason: string; count: number }[]
  byDepartment: { department_name: string; turnover_rate: number }[]
  byResignType: { resign_type: string; count: number }[]
}

export interface WorkforceData {
  byDepartment: { department_id: string; department_name: string; headcount: number }[]
  byEmploymentType: { employment_type: string; headcount: number }[]
  byGrade: { grade_code: string; grade_name: string; headcount: number }[]
}
