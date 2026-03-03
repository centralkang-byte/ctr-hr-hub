// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll Types
// ═══════════════════════════════════════════════════════════

// ─── Payroll Item Detail (stored in PayrollItem.detail JSON) ──

export interface PayrollEarnings {
  baseSalary: number
  fixedOvertimeAllowance: number
  mealAllowance: number
  transportAllowance: number
  overtimePay: number
  nightShiftPay: number
  holidayPay: number
  bonuses: number
  otherEarnings: number
}

export interface PayrollDeductions {
  nationalPension: number
  healthInsurance: number
  longTermCare: number
  employmentInsurance: number
  incomeTax: number
  localIncomeTax: number
  otherDeductions: number
}

export interface PayrollOvertime {
  hourlyWage: number
  totalOvertimeHours: number
  weekdayOTHours: number
  weekendHours: number
  holidayHours: number
  nightHours: number
}

export interface CustomPayItem {
  code: string
  name: string
  amount: number
  category: string
  isTaxExempt?: boolean
}

export interface PayrollItemDetail {
  earnings: PayrollEarnings
  deductions: PayrollDeductions
  overtime: PayrollOvertime
  grossPay: number
  totalDeductions: number
  netPay: number
  // B7-1a: 비과세 분리 + 일할계산 + 이상감지
  taxableIncome?: number
  nontaxableTotal?: number
  isProrated?: boolean
  prorateRatio?: number
  workDays?: number
  anomalies?: Array<{ type: 'WARNING' | 'INFO'; code: string; message: string }>
  customAllowances?: CustomPayItem[]
  customDeductions?: CustomPayItem[]
  previousMonth?: {
    grossPay: number
    totalDeductions: number
    netPay: number
    earnings: PayrollEarnings
    deductions: PayrollDeductions
  }
}

// ─── Anomaly Detection ──────────────────────────────────

export type AnomalySeverity = 'INFO' | 'WARNING' | 'ERROR'

export interface PayrollAnomaly {
  employeeId: string
  employeeName: string
  severity: AnomalySeverity
  message: string
  field: string
  currentValue: number
  previousValue?: number
}

export interface PayrollAnomalyResult {
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
  findings: string[]
  items_to_review: Array<{
    employeeId: string
    employeeName: string
    issue: string
    severity: AnomalySeverity
  }>
  recommendation: string
}

// ─── Severance ──────────────────────────────────────────

export interface SeveranceDetail {
  employeeId: string
  employeeName: string
  hireDate: string
  terminationDate: string
  tenureDays: number
  tenureYears: number
  isEligible: boolean
  recentThreeMonths: Array<{
    yearMonth: string
    baseSalary: number
    overtimePay: number
    allowances: number
    totalPay: number
  }>
  averageMonthlyPay: number
  severancePay: number
  incomeTax: number
  localIncomeTax: number
  netSeverancePay: number
}

// ─── Review Summary ─────────────────────────────────────

export interface PayrollReviewSummary {
  headcount: number
  totalGross: number
  totalDeductions: number
  totalNet: number
  anomalies: PayrollAnomaly[]
}
