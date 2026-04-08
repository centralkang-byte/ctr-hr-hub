// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll, Compensation & Analytics Test Helpers
// Thin wrappers around ApiClient for P6 module tests.
// Covers: payroll runs, allowance/deduction types, dashboard,
//         anomalies, payslips, simulation scenarios, salary bands,
//         compensation analysis/history/matrix/letters,
//         analytics dashboards (overview/executive/domain).
// ═══════════════════════════════════════════════════════════

import { ApiClient, type ApiResult } from './api-client'

const PAY = '/api/v1/payroll'
const COMP = '/api/v1/compensation'
const ANA = '/api/v1/analytics'

// ─── A. Payroll Runs ────────────────────────────────────────

export function listPayrollRuns(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${PAY}/runs`, params)
}

export function createPayrollRun(
  client: ApiClient,
  data: {
    name: string
    runType?: string
    yearMonth: string
    periodStart: string
    periodEnd: string
    payDate?: string
    currency?: string
  },
): Promise<ApiResult> {
  return client.post(`${PAY}/runs`, data)
}

export function getPayrollRun(client: ApiClient, id: string): Promise<ApiResult> {
  return client.get(`${PAY}/runs/${id}`)
}

export function submitForApproval(client: ApiClient, runId: string): Promise<ApiResult> {
  return client.post(`${PAY}/${runId}/submit-for-approval`)
}

export function getRunAdjustments(
  client: ApiClient,
  runId: string,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${PAY}/${runId}/adjustments`, params)
}

export function buildPayrollRun(prefix: string) {
  return {
    name: `E2E ${prefix} Run ${Date.now()}`,
    runType: 'MONTHLY' as const,
    yearMonth: '2099-01',
    periodStart: '2099-01-01T00:00:00.000Z',
    periodEnd: '2099-01-31T23:59:59.000Z',
    currency: 'KRW',
  }
}

// ─── B. Allowance Types ─────────────────────────────────────

export function listAllowanceTypes(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${PAY}/allowance-types`, params)
}

export function createAllowanceType(
  client: ApiClient,
  data: {
    code: string
    name: string
    category: string
    isTaxExempt?: boolean
    calculationMethod?: string
    defaultAmount?: number
    description?: string
    sortOrder?: number
  },
): Promise<ApiResult> {
  return client.post(`${PAY}/allowance-types`, data)
}

export function getAllowanceType(client: ApiClient, id: string): Promise<ApiResult> {
  return client.get(`${PAY}/allowance-types/${id}`)
}

export function updateAllowanceType(
  client: ApiClient,
  id: string,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  return client.put(`${PAY}/allowance-types/${id}`, data)
}

export function deleteAllowanceType(client: ApiClient, id: string): Promise<ApiResult> {
  return client.del(`${PAY}/allowance-types/${id}`)
}

export function buildAllowanceType(prefix: string) {
  const ts = Date.now() % 100000
  return {
    code: `E2E-ALW-${ts}`,
    name: `E2E수당 ${prefix} ${ts}`,
    category: 'FIXED' as const,
    isTaxExempt: false,
    calculationMethod: 'FIXED_AMOUNT' as const,
    defaultAmount: 100000,
  }
}

// ─── C. Deduction Types ─────────────────────────────────────

export function listDeductionTypes(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${PAY}/deduction-types`, params)
}

export function createDeductionType(
  client: ApiClient,
  data: {
    code: string
    name: string
    category: string
    calculationMethod?: string
    rate?: number
    description?: string
    sortOrder?: number
  },
): Promise<ApiResult> {
  return client.post(`${PAY}/deduction-types`, data)
}

export function getDeductionType(client: ApiClient, id: string): Promise<ApiResult> {
  return client.get(`${PAY}/deduction-types/${id}`)
}

export function updateDeductionType(
  client: ApiClient,
  id: string,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  return client.put(`${PAY}/deduction-types/${id}`, data)
}

export function deleteDeductionType(client: ApiClient, id: string): Promise<ApiResult> {
  return client.del(`${PAY}/deduction-types/${id}`)
}

export function buildDeductionType(prefix: string) {
  const ts = Date.now() % 100000
  return {
    code: `E2E-DED-${ts}`,
    name: `E2E공제 ${prefix} ${ts}`,
    category: 'VOLUNTARY' as const,
    calculationMethod: 'FIXED_AMOUNT' as const,
  }
}

// ─── D. Dashboard, Anomalies, Payslips, Me ──────────────────

export function getPayrollDashboard(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${PAY}/dashboard`, params)
}

export function getPayrollAnomalies(
  client: ApiClient,
  params: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${PAY}/anomalies`, params)
}

export function listPayslips(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${PAY}/payslips`, params)
}

export function getMyPayslips(client: ApiClient): Promise<ApiResult> {
  return client.get(`${PAY}/me`)
}

export function getExchangeRates(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${PAY}/exchange-rates`, params)
}

export function getAttendanceStatus(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${PAY}/attendance-status`, params)
}

export function getPayrollWhitelist(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${PAY}/whitelist`, params)
}

export function getEmployeePayItems(
  client: ApiClient,
  employeeId: string,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${PAY}/employees/${employeeId}/pay-items`, params)
}

// ─── E. Simulation Scenarios ────────────────────────────────

export function listSimScenarios(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${PAY}/simulation/scenarios`, params)
}

export function createSimScenario(
  client: ApiClient,
  data: {
    mode: string
    title: string
    description?: string
    companyId?: string | null
    parameters: Record<string, unknown>
    results: Record<string, unknown>
  },
): Promise<ApiResult> {
  return client.post(`${PAY}/simulation/scenarios`, data)
}

export function getSimScenario(client: ApiClient, id: string): Promise<ApiResult> {
  return client.get(`${PAY}/simulation/scenarios/${id}`)
}

export function deleteSimScenario(client: ApiClient, id: string): Promise<ApiResult> {
  return client.del(`${PAY}/simulation/scenarios/${id}`)
}

export function buildSimScenario(prefix: string) {
  return {
    mode: 'SINGLE' as const,
    title: `E2E Scenario ${prefix} ${Date.now()}`,
    description: 'E2E test scenario',
    companyId: null,
    parameters: { adjustmentPct: 5 },
    results: { summary: { totalCost: 0 } },
  }
}

// ─── F. Salary Bands ────────────────────────────────────────

export function listSalaryBands(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${COMP}/salary-bands`, params)
}

export function createSalaryBand(
  client: ApiClient,
  data: {
    jobGradeId: string
    jobCategoryId?: string
    currency?: string
    minSalary: number
    midSalary: number
    maxSalary: number
    effectiveFrom: string
    effectiveTo?: string
  },
): Promise<ApiResult> {
  return client.post(`${COMP}/salary-bands`, data)
}

export function getSalaryBand(client: ApiClient, id: string): Promise<ApiResult> {
  return client.get(`${COMP}/salary-bands/${id}`)
}

export function updateSalaryBand(
  client: ApiClient,
  id: string,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  return client.put(`${COMP}/salary-bands/${id}`, data)
}

export function deleteSalaryBand(client: ApiClient, id: string): Promise<ApiResult> {
  return client.del(`${COMP}/salary-bands/${id}`)
}

export function buildSalaryBand(jobGradeId: string) {
  return {
    jobGradeId,
    currency: 'KRW',
    minSalary: 30_000_000 + (Date.now() % 1000),
    midSalary: 45_000_000 + (Date.now() % 1000),
    maxSalary: 60_000_000 + (Date.now() % 1000),
    effectiveFrom: new Date().toISOString(),
  }
}

// ─── Compensation Analysis / History / Matrix / Letters ─────

export function getCompensationAnalysis(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${COMP}/analysis`, params)
}

export function getCompensationHistory(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${COMP}/history`, params)
}

export function getCompensationMatrix(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${COMP}/matrix`, params)
}

export function getCompensationSimulation(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${COMP}/simulation`, params)
}

export function listCompensationLetters(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${COMP}/letters`, params)
}

// ─── G. Analytics Wrappers ──────────────────────────────────

export function getAnalyticsOverview(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${ANA}/overview`, params)
}

export function getExecutiveSummary(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${ANA}/executive/summary`, params)
}

export function getExecutiveDrilldown(
  client: ApiClient,
  params: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${ANA}/executive/drilldown`, params)
}

export function getPayrollAnalyticsOverview(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${ANA}/payroll/overview`, params)
}

export function getCompaRatioAnalytics(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${ANA}/payroll/compa-ratio`, params)
}

export function getWorkforceOverview(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${ANA}/workforce/overview`, params)
}

export function getTeamHealthOverview(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${ANA}/team-health/overview`, params)
}

export function getTurnoverAnalytics(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${ANA}/turnover`, params)
}

export function getPerformanceOverview(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${ANA}/performance/overview`, params)
}

export function getAttendanceAnalytics(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${ANA}/attendance/overview`, params)
}

export function getCompensationAnalyticsView(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${ANA}/compensation`, params)
}

export function getBurnoutAnalytics(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${ANA}/burnout`, params)
}

export function getEmployeeRisk(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${ANA}/employee-risk`, params)
}

export function getTeamHealthScores(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${ANA}/team-health-scores`, params)
}

export function getRecruitmentAnalytics(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${ANA}/recruitment`, params)
}

export function postAnalyticsCalculate(
  client: ApiClient,
  data?: Record<string, unknown>,
): Promise<ApiResult> {
  return client.post(`${ANA}/calculate`, data ?? {})
}

export function postAnalyticsRefresh(client: ApiClient): Promise<ApiResult> {
  return client.post(`${ANA}/refresh`, {})
}
