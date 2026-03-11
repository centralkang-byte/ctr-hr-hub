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
