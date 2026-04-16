// ═══════════════════════════════════════════════════════════
// Phase 2 API P14 — Fixtures
// CFR (One-on-Ones + Recognitions), Audit, Dashboard Deep,
// Profile Change Requests, Compensation Deep, Entity Transfers,
// Approvals Inbox, My Documents, Unified Tasks
// ═══════════════════════════════════════════════════════════

import { ApiClient, type ApiResult } from './api-client'

const ts = () => Date.now() % 100000

// ─── CFR: One-on-Ones ────────────────────────────────────
const ONE_ON_ONES = '/api/v1/cfr/one-on-ones'
const ONE_ON_ONES_DASHBOARD = '/api/v1/cfr/one-on-ones/dashboard'

// ─── CFR: Recognitions ───────────────────────────────────
const RECOGNITIONS = '/api/v1/cfr/recognitions'
const RECOGNITION_STATS = '/api/v1/cfr/recognitions/stats'

// ─── Audit ───────────────────────────────────────────────
const AUDIT_LOGS = '/api/v1/audit/logs'
const AUDIT_LOGS_EXPORT = '/api/v1/audit/logs/export'
const AUDIT_LOGS_STATS = '/api/v1/audit/logs/stats'
const AUDIT_RETENTION = '/api/v1/audit/retention-policy'
const COMPLIANCE_CRON_RETENTION = '/api/v1/compliance/cron/retention'

// ─── Dashboard ───────────────────────────────────────────
const DASHBOARD_COMPARE = '/api/v1/dashboard/compare'
const DASHBOARD_COMPARE_EXPORT = '/api/v1/dashboard/compare/export'
const DASHBOARD_SUMMARY = '/api/v1/dashboard/summary'
const DASHBOARD_WIDGETS = '/api/v1/dashboard/widgets'

// ─── Profile Change Requests ─────────────────────────────
const PROFILE_CHANGE_REQ = '/api/v1/profile/change-requests'
const PROFILE_CHANGE_PENDING = '/api/v1/profile/change-requests/pending'

// ─── Compensation: Letters ───────────────────────────────
const COMP_LETTERS = '/api/v1/compensation/letters'
const COMP_LETTERS_SEND = '/api/v1/compensation/letters/send'

// ─── Compensation: Matrix ────────────────────────────────
const COMP_MATRIX = '/api/v1/compensation/matrix'
const COMP_MATRIX_COPY = '/api/v1/compensation/matrix/copy'

// ─── Compensation: Salary Bands ──────────────────────────
const SALARY_BANDS = '/api/v1/compensation/salary-bands'

// ─── Compensation: Simulation ────────────────────────────
const COMP_SIMULATION = '/api/v1/compensation/simulation'
const COMP_SIM_AI = '/api/v1/compensation/simulation/ai-recommend'

// ─── Entity Transfers ────────────────────────────────────
const ENTITY_TRANSFERS = '/api/v1/entity-transfers'

// ─── Approvals Inbox ─────────────────────────────────────
const APPROVALS_INBOX = '/api/v1/approvals/inbox'

// ─── My Documents ────────────────────────────────────────
const MY_DOCS = '/api/v1/my/documents'
const MY_CERT_REQUESTS = '/api/v1/my/documents/certificate-requests'
const MY_REQUEST_CERT = '/api/v1/my/documents/request-certificate'

// ─── Unified Tasks ───────────────────────────────────────
const UNIFIED_TASKS = '/api/v1/unified-tasks'

// ═══════════════════════════════════════════════════════════
// Seed resolvers — lookup IDs from seeded data
// ═══════════════════════════════════════════════════════════

let _employeeId: string | null = null
let _secondEmployeeId: string | null = null
let _cycleId: string | null = null
let _companyId: string | null = null
let _secondCompanyId: string | null = null
let _jobGradeId: string | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveEmployeeId(c: ApiClient): Promise<string> {
  if (_employeeId) return _employeeId
  const res = await c.get('/api/v1/employees', { page: '1', limit: '1' })
  _employeeId = (res.data as { id: string }[])?.[0]?.id ?? ''
  return _employeeId
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveSecondEmployeeId(c: ApiClient): Promise<string> {
  if (_secondEmployeeId) return _secondEmployeeId
  const res = await c.get('/api/v1/employees', { page: '1', limit: '5' })
  const list = res.data as { id: string }[]
  _secondEmployeeId = list?.[1]?.id ?? list?.[0]?.id ?? ''
  return _secondEmployeeId
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveCycleId(c: ApiClient): Promise<string> {
  if (_cycleId) return _cycleId
  const res = await c.get('/api/v1/performance/cycles', { page: '1', limit: '1' })
  _cycleId = (res.data as { id: string }[])?.[0]?.id ?? ''
  return _cycleId
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveCompanyIds(c: ApiClient): Promise<{ primary: string; secondary: string }> {
  if (_companyId && _secondCompanyId) return { primary: _companyId, secondary: _secondCompanyId }
  const res = await c.get('/api/v1/org/companies')
  const list = res.data as { id: string }[]
  _companyId = list?.[0]?.id ?? ''
  _secondCompanyId = list?.[1]?.id ?? _companyId
  return { primary: _companyId, secondary: _secondCompanyId }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveJobGradeId(c: ApiClient): Promise<string> {
  if (_jobGradeId) return _jobGradeId
  const res = await c.get('/api/v1/job-grades')
  _jobGradeId = (res.data as { id: string }[])?.[0]?.id ?? ''
  return _jobGradeId
}

// ═══════════════════════════════════════════════════════════
// Builders — request body factories
// ═══════════════════════════════════════════════════════════

function futureDateStr(daysFromNow = 7): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString()
}

// --- CFR ---

export function buildOneOnOne(employeeId: string) {
  return {
    employeeId,
    scheduledAt: futureDateStr(3),
    meetingType: 'REGULAR',
    agenda: `E2E One-on-One agenda ${ts()}`,
  }
}

export function buildOneOnOneUpdate(status?: string) {
  return {
    notes: `E2E meeting notes ${ts()}`,
    actionItems: [
      { item: `Action item ${ts()}`, assignee: 'EMPLOYEE', dueDate: futureDateStr(14), completed: false },
    ],
    ...(status ? { status } : {}),
  }
}

export function buildRecognition(receiverId: string) {
  return {
    receiverId,
    coreValue: 'TRUST',
    message: `E2E recognition message for outstanding work ${ts()}`,
    isPublic: true,
  }
}

// --- Profile ---

export function buildProfileChangeRequest() {
  return {
    fieldName: 'phone',
    newValue: `010-${ts()}-9999`,
    reason: `E2E phone update ${ts()}`,
  }
}

export function buildProfileReview(action: 'APPROVE' | 'REJECT', rejectionReason?: string) {
  return {
    action,
    ...(rejectionReason ? { rejectionReason } : {}),
  }
}

// --- Compensation ---

export function buildLetterGenerate(cycleId: string) {
  return { cycleId }
}

export function buildLetterSend(letterIds: string[]) {
  return { letterIds }
}

export function buildMatrixEntries(cycleId?: string) {
  return {
    ...(cycleId ? { cycleId } : {}),
    entries: [
      { emsBlock: 'EXCEEDS', recommendedIncreasePct: 8, minIncreasePct: 5, maxIncreasePct: 12 },
      { emsBlock: 'MEETS', recommendedIncreasePct: 4, minIncreasePct: 2, maxIncreasePct: 6 },
    ],
  }
}

export function buildMatrixCopy(sourceCycleId: string, targetCycleId: string) {
  return { sourceCycleId, targetCycleId }
}

export function buildSalaryBand(jobGradeId: string) {
  return {
    jobGradeId,
    currency: 'KRW',
    minSalary: 30000000,
    midSalary: 45000000,
    maxSalary: 60000000,
    effectiveFrom: new Date().toISOString(),
  }
}

export function buildSalaryBandUpdate() {
  return {
    minSalary: 32000000,
    midSalary: 47000000,
    maxSalary: 62000000,
  }
}

export function buildAiRecommend(cycleId: string, employeeId: string) {
  return {
    cycleId,
    employeeId,
    budgetConstraint: 5.0,
    companyAvgRaise: 4.5,
  }
}

// --- Entity Transfers ---

export function buildEntityTransfer(employeeId: string, toCompanyId: string) {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return {
    employeeId,
    toCompanyId,
    transferType: 'PERMANENT_TRANSFER',
    transferDate: d.toISOString().slice(0, 10), // YYYY-MM-DD (schema requires date-only)
  }
}

export function buildTransferApproval(action: 'approve' | 'reject', reason?: string) {
  return {
    action,
    ...(reason ? { cancellationReason: reason } : {}),
  }
}

// --- Self-service ---

export function buildCertificateRequest() {
  return {
    type: 'EMPLOYMENT_CERT',
    purpose: `E2E certificate request ${ts()}`,
  }
}

// ═══════════════════════════════════════════════════════════
// Wrapper functions — API calls
// ═══════════════════════════════════════════════════════════

// --- CFR: One-on-Ones ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listOneOnOnes(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(ONE_ON_ONES, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createOneOnOne(c: ApiClient, data: ReturnType<typeof buildOneOnOne>): Promise<ApiResult<any>> {
  return c.post(ONE_ON_ONES, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getOneOnOne(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${ONE_ON_ONES}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateOneOnOne(c: ApiClient, id: string, data: ReturnType<typeof buildOneOnOneUpdate>): Promise<ApiResult<any>> {
  return c.put(`${ONE_ON_ONES}/${id}`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getOneOnOneDashboard(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(ONE_ON_ONES_DASHBOARD)
}

// --- CFR: Recognitions ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listRecognitions(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(RECOGNITIONS, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createRecognition(c: ApiClient, data: ReturnType<typeof buildRecognition>): Promise<ApiResult<any>> {
  return c.post(RECOGNITIONS, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function likeRecognition(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.post(`${RECOGNITIONS}/${id}/like`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRecognitionStats(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(RECOGNITION_STATS)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getEmployeeRecognitions(c: ApiClient, empId: string): Promise<ApiResult<any>> {
  return c.get(`${RECOGNITIONS}/employee/${empId}`)
}

// --- Audit ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listAuditLogs(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(AUDIT_LOGS, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportAuditLogs(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(AUDIT_LOGS_EXPORT, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAuditStats(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(AUDIT_LOGS_STATS, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRetentionPolicy(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(AUDIT_RETENTION)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateRetentionPolicy(c: ApiClient, days: number): Promise<ApiResult<any>> {
  return c.put(AUDIT_RETENTION, { retentionDays: days })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function triggerCronRetention(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(COMPLIANCE_CRON_RETENTION)
}

// --- Dashboard ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDashboardCompare(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(DASHBOARD_COMPARE, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDashboardCompareExport(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(DASHBOARD_COMPARE_EXPORT, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDashboardSummary(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(DASHBOARD_SUMMARY, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDashboardWidget(c: ApiClient, widgetId: string, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(`${DASHBOARD_WIDGETS}/${widgetId}`, params)
}

// --- Profile Change Requests ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listChangeRequests(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(PROFILE_CHANGE_REQ)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createChangeRequest(c: ApiClient, data: ReturnType<typeof buildProfileChangeRequest>): Promise<ApiResult<any>> {
  return c.post(PROFILE_CHANGE_REQ, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function reviewChangeRequest(c: ApiClient, id: string, data: ReturnType<typeof buildProfileReview>): Promise<ApiResult<any>> {
  return c.put(`${PROFILE_CHANGE_REQ}/${id}/review`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listPendingChangeRequests(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(PROFILE_CHANGE_PENDING)
}

// --- Compensation: Letters ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listCompLetters(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(COMP_LETTERS, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateCompLetters(c: ApiClient, data: ReturnType<typeof buildLetterGenerate>): Promise<ApiResult<any>> {
  return c.post(COMP_LETTERS, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCompLetter(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${COMP_LETTERS}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sendCompLetters(c: ApiClient, data: ReturnType<typeof buildLetterSend>): Promise<ApiResult<any>> {
  return c.post(COMP_LETTERS_SEND, data)
}

// --- Compensation: Matrix ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCompMatrix(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(COMP_MATRIX, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function upsertCompMatrix(c: ApiClient, data: ReturnType<typeof buildMatrixEntries>): Promise<ApiResult<any>> {
  return c.post(COMP_MATRIX, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function copyCompMatrix(c: ApiClient, data: ReturnType<typeof buildMatrixCopy>): Promise<ApiResult<any>> {
  return c.post(COMP_MATRIX_COPY, data)
}

// --- Compensation: Salary Bands ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listSalaryBands(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(SALARY_BANDS, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSalaryBand(c: ApiClient, data: ReturnType<typeof buildSalaryBand>): Promise<ApiResult<any>> {
  return c.post(SALARY_BANDS, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSalaryBand(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${SALARY_BANDS}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateSalaryBand(c: ApiClient, id: string, data: ReturnType<typeof buildSalaryBandUpdate>): Promise<ApiResult<any>> {
  return c.put(`${SALARY_BANDS}/${id}`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deleteSalaryBand(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.del(`${SALARY_BANDS}/${id}`)
}

// --- Compensation: Simulation ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCompSimulation(c: ApiClient, params: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(COMP_SIMULATION, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function postAiRecommend(c: ApiClient, data: ReturnType<typeof buildAiRecommend>): Promise<ApiResult<any>> {
  return c.post(COMP_SIM_AI, data)
}

// --- Entity Transfers ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listEntityTransfers(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(ENTITY_TRANSFERS, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createEntityTransfer(c: ApiClient, data: ReturnType<typeof buildEntityTransfer>): Promise<ApiResult<any>> {
  return c.post(ENTITY_TRANSFERS, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getEntityTransfer(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${ENTITY_TRANSFERS}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function approveEntityTransfer(c: ApiClient, id: string, data: ReturnType<typeof buildTransferApproval>): Promise<ApiResult<any>> {
  return c.put(`${ENTITY_TRANSFERS}/${id}/approve`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function executeEntityTransfer(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.put(`${ENTITY_TRANSFERS}/${id}/execute`)
}

// --- Approvals Inbox ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getApprovalsInbox(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(APPROVALS_INBOX, params)
}

// --- My Documents ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listMyDocuments(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(MY_DOCS)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function downloadMyDocument(c: ApiClient, docId: string): Promise<ApiResult<any>> {
  return c.get(`${MY_DOCS}/${docId}/download`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listMyCertRequests(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(MY_CERT_REQUESTS)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function requestCertificate(c: ApiClient, data: ReturnType<typeof buildCertificateRequest>): Promise<ApiResult<any>> {
  return c.post(MY_REQUEST_CERT, data)
}

// --- Unified Tasks ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listUnifiedTasks(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(UNIFIED_TASKS, params)
}
