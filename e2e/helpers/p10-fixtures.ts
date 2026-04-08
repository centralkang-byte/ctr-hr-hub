// ═══════════════════════════════════════════════════════════
// CTR HR Hub — P10 Test Helpers
// peer-review, succession, competencies, year-end,
// attrition, bank-transfers, benefit-plans/claims/budgets,
// approvals-attendance, tax-brackets, payroll sub-routes, misc
// ═══════════════════════════════════════════════════════════

import { ApiClient, type ApiResult } from './api-client'
import type { APIRequestContext } from '@playwright/test'
import { parseApiResponse } from './api-client'

// ─── Path Constants ──────────────────────────────────────

const COMPETENCY = '/api/v1/competencies'
const SUCCESSION = '/api/v1/succession/plans'
const SUCCESSION_CANDIDATES = '/api/v1/succession/candidates'
const SUCCESSION_DASH = '/api/v1/succession/dashboard'
const SUCCESSION_READINESS = '/api/v1/succession/readiness-batch'
const PEER_NOM = '/api/v1/peer-review/nominations'
const PEER_RECOMMEND = '/api/v1/peer-review/recommend'
const PEER_MY = '/api/v1/peer-review/my-reviews'
const PEER_RESULTS = '/api/v1/peer-review/results'
const PEER_TEAM = '/api/v1/peer-review/results/team'
const YEAR_END = '/api/v1/year-end/settlements'
const YEAR_END_HR = '/api/v1/year-end/hr/settlements'
const YEAR_END_HR_BULK = '/api/v1/year-end/hr/bulk-confirm'
const ATTRITION = '/api/v1/attrition'
const BANK_XFER = '/api/v1/bank-transfers'
const BENEFIT_PLANS = '/api/v1/benefit-plans'
const BENEFIT_CLAIMS = '/api/v1/benefit-claims'
const BENEFIT_BUDGETS = '/api/v1/benefit-budgets'
const APPROVALS_ATT = '/api/v1/approvals/attendance'
const TAX_BRACKETS = '/api/v1/tax-brackets'
const PAYROLL_FX = '/api/v1/payroll/exchange-rates'
const PAYROLL_IMPORT = '/api/v1/payroll/import-logs'
const PAYROLL_WHITELIST = '/api/v1/payroll/whitelist'
const PAYROLL_MAPPINGS = '/api/v1/payroll/import-mappings'
const CONTRACTS_EXP = '/api/v1/contracts/expiring'
const WORK_PERMITS_EXP = '/api/v1/work-permits/expiring'

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
 * Resolve a competency category ID from seed data.
 * GET /competencies → extract first item's categoryId.
 * Falls back to undefined if none exist.
 */
export async function resolveCategoryId(c: ApiClient): Promise<string | undefined> {
  const res = await c.get<Array<{ category?: { id: string } }>>(COMPETENCY)
  if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
    return res.data[0]?.category?.id
  }
  return undefined
}

/**
 * Resolve a performance cycle ID for peer review tests.
 * First tries to find an existing cycle, then creates one via eval-fixtures if needed.
 */
export async function resolveCycleId(request: APIRequestContext): Promise<string | undefined> {
  const res = await request.get('/api/v1/performance/cycles')
  const { ok, data } = await parseApiResponse(res)
  if (ok && Array.isArray(data) && data.length > 0) {
    // Use an existing cycle
    return (data[0] as { id: string }).id
  }
  // Create a new cycle if none exist — import dynamically to avoid circular deps
  try {
    const { createTestCycle } = await import('./eval-fixtures')
    return await createTestCycle(request, {
      name: `P10 Peer Review Cycle ${Date.now()}`,
      year: 2098,
      half: 'H1',
    })
  } catch {
    return undefined
  }
}

/**
 * Resolve a second employee ID (정다은) for peer review nominee.
 */
export async function resolveSecondEmployeeId(request: APIRequestContext): Promise<string | undefined> {
  const res = await request.get('/api/v1/employees?search=정다은&page=1&limit=1')
  const { ok, data } = await parseApiResponse(res)
  if (ok && Array.isArray(data) && data.length > 0) {
    return (data[0] as { id: string }).id
  }
  return undefined
}

// ═══════════════════════════════════════════════════════════
// BUILDERS
// ═══════════════════════════════════════════════════════════

export function buildCompetency(categoryId: string) {
  const t = ts()
  return {
    categoryId,
    code: `E2E_COMP_${t}`,
    name: `E2E 역량 ${t}`,
    nameEn: `E2E Competency ${t}`,
    description: 'E2E test competency',
    displayOrder: 99,
  }
}

export function buildCompetencyIndicators() {
  return {
    indicators: [
      { indicatorText: 'E2E 행동지표 1', displayOrder: 1 },
      { indicatorText: 'E2E 행동지표 2', displayOrder: 2 },
    ],
  }
}

export function buildCompetencyLevels() {
  return {
    levels: [
      { level: 1, label: '초급', description: 'Beginner level' },
      { level: 2, label: '중급', description: 'Intermediate level' },
      { level: 3, label: '고급', description: 'Advanced level' },
    ],
  }
}

export function buildSuccessionPlan(departmentId?: string) {
  const t = ts()
  return {
    positionTitle: `E2E Succession Position ${t}`,
    criticality: 'CRITICAL' as const,
    notes: `E2E test succession plan ${t}`,
    ...(departmentId ? { departmentId } : {}),
  }
}

export function buildSuccessionCandidate(employeeId: string) {
  return {
    employeeId,
    readiness: 'READY_NOW' as const,
    notes: 'E2E test candidate',
  }
}

export function buildPeerNomination(cycleId: string, employeeId: string, nomineeId: string) {
  return {
    cycleId,
    employeeId,
    nomineeId,
    nominationSource: 'HR_ASSIGNED' as const,
  }
}

export function buildPeerEvalSubmission() {
  return {
    competencyDetail: { leadership: 4, teamwork: 3 },
    comment: 'E2E peer evaluation submission for testing purposes.',
    competencyScore: 4,
  }
}

export function buildYearEndDependents() {
  return {
    dependents: [
      {
        relationship: '배우자',
        name: 'E2E 배우자',
        birthDate: '1990-01-15',
        isDisabled: false,
        isSenior: false,
        deductionAmount: 1500000,
        additionalDeduction: 0,
      },
    ],
  }
}

export function buildYearEndDeductions() {
  return {
    deductions: [
      {
        configCode: 'INSURANCE',
        category: '보험료',
        name: 'E2E 국민건강보험',
        inputAmount: 2400000,
      },
    ],
  }
}

export function buildYearEndDocument() {
  return {
    documentType: 'INSURANCE_RECEIPT',
    fileName: 'e2e-insurance-2099.pdf',
    filePath: '/uploads/e2e/insurance-2099.pdf',
  }
}

export function buildBankTransferBatch(payrollRunId?: string) {
  const t = ts()
  return {
    bankCode: 'KB',
    bankName: `E2E Bank ${t}`,
    format: 'STANDARD',
    ...(payrollRunId ? { payrollRunId } : {}),
  }
}

export function buildTaxBracket() {
  const t = ts()
  return {
    countryCode: 'KR',
    taxType: `E2E_TAX_${t}`,
    name: `E2E Tax Bracket ${t}`,
    bracketMin: 0,
    bracketMax: 12000000,
    rate: 6,
    fixedAmount: 0,
    effectiveFrom: '2099-01-01',
  }
}

export function buildBenefitBudget(companyId: string) {
  return {
    companyId,
    year: 2099,
    category: 'HEALTH',
    totalBudget: 50000000,
  }
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Competencies (MODULE.SETTINGS)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listCompetencies(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(COMPETENCY, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCompetency(c: ApiClient, data: ReturnType<typeof buildCompetency>): Promise<ApiResult<any>> {
  return c.post(COMPETENCY, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCompetency(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${COMPETENCY}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateCompetency(c: ApiClient, id: string, data: Record<string, unknown>): Promise<ApiResult<any>> {
  return c.put(`${COMPETENCY}/${id}`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deleteCompetency(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.del(`${COMPETENCY}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getIndicators(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${COMPETENCY}/${id}/indicators`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function putIndicators(c: ApiClient, id: string, data: ReturnType<typeof buildCompetencyIndicators>): Promise<ApiResult<any>> {
  return c.put(`${COMPETENCY}/${id}/indicators`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getLevels(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${COMPETENCY}/${id}/levels`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function putLevels(c: ApiClient, id: string, data: ReturnType<typeof buildCompetencyLevels>): Promise<ApiResult<any>> {
  return c.put(`${COMPETENCY}/${id}/levels`, data)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Succession (MODULE.SUCCESSION)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listPlans(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(SUCCESSION, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createPlan(c: ApiClient, data: ReturnType<typeof buildSuccessionPlan>): Promise<ApiResult<any>> {
  return c.post(SUCCESSION, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPlan(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${SUCCESSION}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updatePlan(c: ApiClient, id: string, data: Record<string, unknown>): Promise<ApiResult<any>> {
  return c.put(`${SUCCESSION}/${id}`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deletePlan(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.del(`${SUCCESSION}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listCandidates(c: ApiClient, planId: string): Promise<ApiResult<any>> {
  return c.get(`${SUCCESSION}/${planId}/candidates`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function addCandidate(c: ApiClient, planId: string, data: ReturnType<typeof buildSuccessionCandidate>): Promise<ApiResult<any>> {
  return c.post(`${SUCCESSION}/${planId}/candidates`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateCandidate(c: ApiClient, candidateId: string, data: Record<string, unknown>): Promise<ApiResult<any>> {
  return c.put(`${SUCCESSION_CANDIDATES}/${candidateId}`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deleteCandidate(c: ApiClient, candidateId: string): Promise<ApiResult<any>> {
  return c.del(`${SUCCESSION_CANDIDATES}/${candidateId}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSuccessionDashboard(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(SUCCESSION_DASH)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function postReadinessBatch(c: ApiClient, data?: Record<string, unknown>): Promise<ApiResult<any>> {
  return c.post(SUCCESSION_READINESS, data ?? {})
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Peer Review (MODULE.PERFORMANCE)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listNominations(c: ApiClient, params: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(PEER_NOM, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNomination(c: ApiClient, data: ReturnType<typeof buildPeerNomination>): Promise<ApiResult<any>> {
  return c.post(PEER_NOM, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateNomination(c: ApiClient, id: string, data: { status: string }): Promise<ApiResult<any>> {
  return c.put(`${PEER_NOM}/${id}`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRecommend(c: ApiClient, params: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(PEER_RECOMMEND, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMyReviews(c: ApiClient, params: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(PEER_MY, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function submitPeerEval(c: ApiClient, nominationId: string, data: ReturnType<typeof buildPeerEvalSubmission>): Promise<ApiResult<any>> {
  return c.post(`${PEER_MY}/${nominationId}`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPeerResults(c: ApiClient, params: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(PEER_RESULTS, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPeerTeamResults(c: ApiClient, params: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(PEER_TEAM, params)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Year-End Settlements (MODULE.PAYROLL)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSettlement(c: ApiClient, year: number): Promise<ApiResult<any>> {
  return c.get(YEAR_END, { year: String(year) })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resetSettlement(c: ApiClient, year: number): Promise<ApiResult<any>> {
  return c.post(YEAR_END, { year })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSettlementDetail(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${YEAR_END}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateSettlement(c: ApiClient, id: string, data: Record<string, unknown>): Promise<ApiResult<any>> {
  return c.put(`${YEAR_END}/${id}`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function putDependents(c: ApiClient, id: string, data: ReturnType<typeof buildYearEndDependents>): Promise<ApiResult<any>> {
  return c.put(`${YEAR_END}/${id}/dependents`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDependents(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${YEAR_END}/${id}/dependents`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function putDeductions(c: ApiClient, id: string, data: ReturnType<typeof buildYearEndDeductions>): Promise<ApiResult<any>> {
  return c.put(`${YEAR_END}/${id}/deductions`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDeductions(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${YEAR_END}/${id}/deductions`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function postDocument(c: ApiClient, id: string, data: ReturnType<typeof buildYearEndDocument>): Promise<ApiResult<any>> {
  return c.post(`${YEAR_END}/${id}/documents`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function calculateSettlement(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.post(`${YEAR_END}/${id}/calculate`, {})
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function submitSettlement(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.post(`${YEAR_END}/${id}/submit`, {})
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listHrSettlements(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(YEAR_END_HR, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function confirmSettlement(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.post(`${YEAR_END_HR}/${id}/confirm`, {})
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function bulkConfirm(c: ApiClient, ids: string[]): Promise<ApiResult<any>> {
  return c.post(YEAR_END_HR_BULK, { settlementIds: ids })
}

/**
 * Receipt is POST and returns HTML — use Playwright request directly.
 */
export async function getReceipt(request: APIRequestContext, id: string): Promise<{ status: number; contentType: string; body: string }> {
  const res = await request.post(`${YEAR_END_HR}/${id}/receipt`)
  return {
    status: res.status(),
    contentType: res.headers()['content-type'] ?? '',
    body: await res.text(),
  }
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Attrition (MODULE.ANALYTICS)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAttritionDashboard(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(`${ATTRITION}/dashboard`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAttritionHeatmap(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(`${ATTRITION}/department-heatmap`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAttritionTrend(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(`${ATTRITION}/trend`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getEmployeeRisk(c: ApiClient, employeeId: string): Promise<ApiResult<any>> {
  return c.get(`${ATTRITION}/employees/${employeeId}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function recalculateAttrition(c: ApiClient): Promise<ApiResult<any>> {
  return c.post(`${ATTRITION}/recalculate`, {})
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Bank Transfers (MODULE.PAYROLL)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listBankBatches(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(BANK_XFER, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createBankBatch(c: ApiClient, data: ReturnType<typeof buildBankTransferBatch>): Promise<ApiResult<any>> {
  return c.post(BANK_XFER, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getBankBatch(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${BANK_XFER}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateBankBatch(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.post(`${BANK_XFER}/${id}/generate`, {})
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Benefit Plans/Claims/Budgets
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listBenefitPlans(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(BENEFIT_PLANS)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listBenefitClaims(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(BENEFIT_CLAIMS, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getClaimSummary(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(`${BENEFIT_CLAIMS}/summary`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listBenefitBudgets(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(BENEFIT_BUDGETS)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function upsertBenefitBudget(c: ApiClient, data: ReturnType<typeof buildBenefitBudget>): Promise<ApiResult<any>> {
  return c.put(BENEFIT_BUDGETS, data)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Approvals Attendance (MODULE.LEAVE)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listAttendanceApprovals(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(APPROVALS_ATT, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getApprovalDetail(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${APPROVALS_ATT}/${id}`)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Tax Brackets (MODULE.SETTINGS)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listTaxBrackets(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(TAX_BRACKETS)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTaxBracket(c: ApiClient, data: ReturnType<typeof buildTaxBracket>): Promise<ApiResult<any>> {
  return c.post(TAX_BRACKETS, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTaxBracket(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${TAX_BRACKETS}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function seedTaxBrackets(c: ApiClient): Promise<ApiResult<any>> {
  return c.post(`${TAX_BRACKETS}/seed`, {})
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Payroll Sub-routes
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getExchangeRates(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(PAYROLL_FX, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getImportLogs(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(PAYROLL_IMPORT)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPayrollWhitelist(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(PAYROLL_WHITELIST)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPayrollMappings(c: ApiClient, companyId: string): Promise<ApiResult<any>> {
  return c.get(PAYROLL_MAPPINGS, { companyId })
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Misc
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getContractsExpiring(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(CONTRACTS_EXP)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getWorkPermitsExpiring(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(WORK_PERMITS_EXP)
}
