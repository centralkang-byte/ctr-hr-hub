// ═══════════════════════════════════════════════════════════
// CTR HR Hub — P12 Test Helpers
// Payroll sub-routes: adjustments, anomalies, approval pipeline,
// exports, attendance close/reopen, calculate, payslips,
// severance, global, simulation scenarios, whitelist
// ═══════════════════════════════════════════════════════════

import { ApiClient, type ApiResult } from './api-client'
import type { APIRequestContext } from '@playwright/test'
import { parseApiResponse } from './api-client'

// ─── Path Constants ──────────────────────────────────────

const PAYROLL_RUNS = '/api/v1/payroll/runs'
const PAYROLL_PAYSLIPS = '/api/v1/payroll/payslips'
const PAYROLL_ME = '/api/v1/payroll/me'
const PAYROLL_CALCULATE = '/api/v1/payroll/calculate'
const PAYROLL_ATT_STATUS = '/api/v1/payroll/attendance-status'
const PAYROLL_ATT_CLOSE = '/api/v1/payroll/attendance-close'
const PAYROLL_ATT_REOPEN = '/api/v1/payroll/attendance-reopen'
const PAYROLL_SEVERANCE = '/api/v1/payroll/severance'
const PAYROLL_GLOBAL = '/api/v1/payroll/global'
const PAYROLL_SIM_SCENARIOS = '/api/v1/payroll/simulation/scenarios'
const PAYROLL_WHITELIST = '/api/v1/payroll/whitelist'

/**
 * Build a payroll run sub-route path.
 * e.g. runSub('abc', 'adjustments') → '/api/v1/payroll/runs/abc/adjustments'
 * Note: [runId] sub-routes live under /api/v1/payroll/[runId]/..., NOT /runs/[runId]/...
 */
export const runSub = (runId: string, sub: string) => `/api/v1/payroll/${runId}/${sub}`

// ─── Uniqueness Helper ──────────────────────────────────

const ts = () => Date.now() % 100000

// ─── Date Helpers ────────────────────────────────────────

function futureDateStr(daysAhead: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString().split('T')[0]
}

// ═══════════════════════════════════════════════════════════
// SEED RESOLVERS
// ═══════════════════════════════════════════════════════════

/**
 * Resolve a payroll run ID in a testable state.
 * Looks for the first PayrollRun from GET /payroll/runs list.
 * Returns undefined if none exist.
 */
export async function resolvePayrollRunId(api: ApiClient): Promise<string | undefined> {
  const res = await api.get<{ items?: Array<{ id: string; status: string }> }>(PAYROLL_RUNS)
  if (res.ok && res.data) {
    // data can be array or { items: [] }
    const items = Array.isArray(res.data) ? res.data : (res.data as { items?: unknown[] }).items
    if (Array.isArray(items) && items.length > 0) {
      return (items[0] as { id: string }).id
    }
  }
  return undefined
}

/**
 * Resolve a payroll run ID in ADJUSTMENT status (for adjustment tests).
 * Falls back to any run if none in ADJUSTMENT.
 */
export async function resolveAdjustmentRunId(api: ApiClient): Promise<string | undefined> {
  const res = await api.get<{ items?: Array<{ id: string; status: string }> }>(PAYROLL_RUNS)
  if (res.ok && res.data) {
    const items = Array.isArray(res.data) ? res.data : (res.data as { items?: unknown[] }).items
    if (Array.isArray(items)) {
      const adjRun = (items as Array<{ id: string; status: string }>).find(
        (r) => r.status === 'ADJUSTMENT',
      )
      if (adjRun) return adjRun.id
      // Fallback to first run
      if (items.length > 0) return (items[0] as { id: string }).id
    }
  }
  return undefined
}

/**
 * Resolve a payroll run ID in REVIEW status (for anomaly/approval tests).
 * Falls back to any run.
 */
export async function resolveReviewRunId(api: ApiClient): Promise<string | undefined> {
  const res = await api.get<{ items?: Array<{ id: string; status: string }> }>(PAYROLL_RUNS)
  if (res.ok && res.data) {
    const items = Array.isArray(res.data) ? res.data : (res.data as { items?: unknown[] }).items
    if (Array.isArray(items)) {
      const reviewRun = (items as Array<{ id: string; status: string }>).find(
        (r) => r.status === 'REVIEW',
      )
      if (reviewRun) return reviewRun.id
      if (items.length > 0) return (items[0] as { id: string }).id
    }
  }
  return undefined
}

/**
 * Resolve a payroll run ID in APPROVED or PAID status (for export tests).
 */
export async function resolveApprovedRunId(api: ApiClient): Promise<string | undefined> {
  const res = await api.get<{ items?: Array<{ id: string; status: string }> }>(PAYROLL_RUNS)
  if (res.ok && res.data) {
    const items = Array.isArray(res.data) ? res.data : (res.data as { items?: unknown[] }).items
    if (Array.isArray(items)) {
      const approved = (items as Array<{ id: string; status: string }>).find(
        (r) => r.status === 'APPROVED' || r.status === 'PAID',
      )
      if (approved) return approved.id
      if (items.length > 0) return (items[0] as { id: string }).id
    }
  }
  return undefined
}

/**
 * Resolve a payroll run ID in PENDING_APPROVAL status.
 */
export async function resolvePendingApprovalRunId(api: ApiClient): Promise<string | undefined> {
  const res = await api.get<{ items?: Array<{ id: string; status: string }> }>(PAYROLL_RUNS)
  if (res.ok && res.data) {
    const items = Array.isArray(res.data) ? res.data : (res.data as { items?: unknown[] }).items
    if (Array.isArray(items)) {
      const pending = (items as Array<{ id: string; status: string }>).find(
        (r) => r.status === 'PENDING_APPROVAL',
      )
      if (pending) return pending.id
      if (items.length > 0) return (items[0] as { id: string }).id
    }
  }
  return undefined
}

/**
 * Resolve an employee ID from the employee list for adjustment targets.
 */
export async function resolveEmployeeIdForPayroll(request: APIRequestContext): Promise<string | undefined> {
  const res = await request.get('/api/v1/employees?search=이민준&page=1&limit=1')
  const { ok, data } = await parseApiResponse(res)
  if (ok && Array.isArray(data) && data.length > 0) {
    return (data[0] as { id: string }).id
  }
  return undefined
}

/**
 * Resolve a company ID from the payroll run.
 */
export async function resolveCompanyId(request: APIRequestContext): Promise<string | undefined> {
  const res = await request.get('/api/v1/employees?search=이민준&page=1&limit=1')
  const { ok, data } = await parseApiResponse(res)
  if (ok && Array.isArray(data) && data.length > 0) {
    const emp = data[0] as { assignments?: Array<{ companyId: string; isPrimary: boolean; endDate: string | null }> }
    const primary = emp.assignments?.find((a) => a.isPrimary && !a.endDate)
    return primary?.companyId
  }
  return undefined
}

// ═══════════════════════════════════════════════════════════
// BUILDERS
// ═══════════════════════════════════════════════════════════

export function buildAdjustment(employeeId: string) {
  const t = ts()
  return {
    employeeId,
    type: 'BONUS' as const,
    category: `E2E Bonus ${t}`,
    description: `E2E test bonus adjustment ${t}`,
    amount: 100000,
  }
}

export function buildRetroactiveAdjustment(employeeId: string) {
  const t = ts()
  return {
    employeeId,
    type: 'RETROACTIVE' as const,
    category: `E2E Retroactive ${t}`,
    description: `E2E retroactive adjustment ${t}`,
    amount: 50000,
  }
}

export function buildDeductionAdjustment(employeeId: string) {
  const t = ts()
  return {
    employeeId,
    type: 'DEDUCTION' as const,
    category: `E2E Deduction ${t}`,
    description: `E2E test deduction ${t}`,
    amount: -30000,
  }
}

export function buildBulkResolve(anomalyIds: string[]) {
  return {
    anomalyIds,
    resolution: 'CONFIRMED_NORMAL' as const,
    note: 'E2E bulk resolve test',
  }
}

export function buildAnomalyResolve() {
  return {
    resolution: 'CONFIRMED_NORMAL' as const,
    note: 'E2E individual resolve test',
  }
}

export function buildSubmitForApproval() {
  return {
    note: 'E2E test submission for approval',
  }
}

export function buildApproveComment() {
  return {
    comment: 'E2E test approval comment',
  }
}

export function buildRejectComment() {
  return {
    comment: 'E2E test rejection — 반려 사유 테스트',
  }
}

export function buildAttendanceClose(companyId: string) {
  const now = new Date()
  return {
    companyId,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    excludeEmployeeIds: [],
  }
}

export function buildAttendanceReopen(payrollRunId: string) {
  return {
    payrollRunId,
    reason: 'E2E test reopen',
  }
}

export function buildCalculatePayload(payrollRunId: string) {
  return {
    payrollRunId,
  }
}

export function buildSeverancePayload() {
  return {
    terminationDate: futureDateStr(30),
  }
}

export function buildSimulationScenario(companyId?: string) {
  const t = ts()
  return {
    mode: 'SINGLE' as const,
    title: `E2E Sim Scenario ${t}`,
    description: `E2E test simulation scenario ${t}`,
    companyId: companyId ?? null,
    parameters: { baseSalaryIncrease: 5 },
    results: { summary: { totalIncrease: 500000 } },
  }
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Adjustments (MODULE.PAYROLL)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listAdjustments(c: ApiClient, runId: string): Promise<ApiResult<any>> {
  return c.get(runSub(runId, 'adjustments'))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAdjustment(c: ApiClient, runId: string, data: Record<string, unknown>): Promise<ApiResult<any>> {
  return c.post(runSub(runId, 'adjustments'), data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deleteAdjustment(c: ApiClient, runId: string, adjustmentId: string): Promise<ApiResult<any>> {
  return c.del(`${runSub(runId, 'adjustments')}/${adjustmentId}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function completeAdjustments(c: ApiClient, runId: string): Promise<ApiResult<any>> {
  return c.post(runSub(runId, 'adjustments/complete'), {})
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Anomalies (MODULE.PAYROLL)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listAnomalies(c: ApiClient, runId: string, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(runSub(runId, 'anomalies'), params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveAnomaly(c: ApiClient, runId: string, anomalyId: string, data?: ReturnType<typeof buildAnomalyResolve>): Promise<ApiResult<any>> {
  return c.put(`${runSub(runId, 'anomalies')}/${anomalyId}/resolve`, data ?? buildAnomalyResolve())
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function bulkResolveAnomalies(c: ApiClient, runId: string, data: Record<string, unknown>): Promise<ApiResult<any>> {
  return c.post(runSub(runId, 'anomalies/bulk-resolve'), data)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Approval Pipeline (MODULE.PAYROLL)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getApprovalStatus(c: ApiClient, runId: string): Promise<ApiResult<any>> {
  return c.get(runSub(runId, 'approval-status'))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function submitForApproval(c: ApiClient, runId: string, data?: ReturnType<typeof buildSubmitForApproval>): Promise<ApiResult<any>> {
  return c.post(runSub(runId, 'submit-for-approval'), data ?? buildSubmitForApproval())
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function approveRun(c: ApiClient, runId: string, data?: ReturnType<typeof buildApproveComment>): Promise<ApiResult<any>> {
  return c.post(runSub(runId, 'approve'), data ?? buildApproveComment())
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rejectRun(c: ApiClient, runId: string, data: ReturnType<typeof buildRejectComment>): Promise<ApiResult<any>> {
  return c.post(runSub(runId, 'reject'), data)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Comparison (MODULE.PAYROLL)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getComparison(c: ApiClient, runId: string, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(runSub(runId, 'comparison'), params)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Notify / Publish Status (MODULE.PAYROLL)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function notifyUnread(c: ApiClient, runId: string): Promise<ApiResult<any>> {
  return c.post(runSub(runId, 'notify-unread'), {})
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPublishStatus(c: ApiClient, runId: string): Promise<ApiResult<any>> {
  return c.get(runSub(runId, 'publish-status'))
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Exports (MODULE.PAYROLL) — use getRaw for binary
// ═══════════════════════════════════════════════════════════

export function exportTransfer(c: ApiClient, runId: string) {
  return c.getRaw(runSub(runId, 'export/transfer'))
}

export function exportJournal(c: ApiClient, runId: string) {
  return c.getRaw(runSub(runId, 'export/journal'))
}

export function exportLedger(c: ApiClient, runId: string) {
  return c.getRaw(runSub(runId, 'export/ledger'))
}

export function exportComparison(c: ApiClient, runId: string) {
  return c.getRaw(runSub(runId, 'export/comparison'))
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Attendance Close/Reopen (MODULE.PAYROLL)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAttendanceStatus(c: ApiClient, params: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(PAYROLL_ATT_STATUS, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function postAttendanceClose(c: ApiClient, data: ReturnType<typeof buildAttendanceClose>): Promise<ApiResult<any>> {
  return c.post(PAYROLL_ATT_CLOSE, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function postAttendanceReopen(c: ApiClient, data: ReturnType<typeof buildAttendanceReopen>): Promise<ApiResult<any>> {
  return c.post(PAYROLL_ATT_REOPEN, data)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Calculate (MODULE.PAYROLL)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function postCalculate(c: ApiClient, data: ReturnType<typeof buildCalculatePayload>): Promise<ApiResult<any>> {
  return c.post(PAYROLL_CALCULATE, data)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Payslips (MODULE.PAYROLL)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listPayslips(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(PAYROLL_PAYSLIPS, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPayslip(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${PAYROLL_PAYSLIPS}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function patchPayslipViewed(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.patch(`${PAYROLL_PAYSLIPS}/${id}`, {})
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMyPayslips(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(PAYROLL_ME)
}

export function getMyPayslipPdf(c: ApiClient, runId: string) {
  return c.getRaw(`${PAYROLL_ME}/${runId}/pdf`)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Severance (MODULE.PAYROLL)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function postSeverance(c: ApiClient, employeeId: string, data: ReturnType<typeof buildSeverancePayload>): Promise<ApiResult<any>> {
  return c.post(`${PAYROLL_SEVERANCE}/${employeeId}`, data)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Global Dashboard (MODULE.PAYROLL)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getGlobalDashboard(c: ApiClient, params: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(PAYROLL_GLOBAL, params)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Simulation Scenarios (MODULE.PAYROLL)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listSimScenarios(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(PAYROLL_SIM_SCENARIOS, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSimScenario(c: ApiClient, data: ReturnType<typeof buildSimulationScenario>): Promise<ApiResult<any>> {
  return c.post(PAYROLL_SIM_SCENARIOS, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSimScenario(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${PAYROLL_SIM_SCENARIOS}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deleteSimScenario(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.del(`${PAYROLL_SIM_SCENARIOS}/${id}`)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Whitelist (MODULE.PAYROLL)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getWhitelist(c: ApiClient, params: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(PAYROLL_WHITELIST, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deleteWhitelistItem(c: ApiClient, anomalyId: string): Promise<ApiResult<any>> {
  return c.del(`${PAYROLL_WHITELIST}/${anomalyId}`)
}
