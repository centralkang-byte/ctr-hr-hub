// ═══════════════════════════════════════════════════════════
// CTR HR Hub — LOA / Discipline / Benefits / Transfers / Self-Service Test Helpers
// Thin wrappers around ApiClient for leave-of-absence,
// discipline/rewards, benefits, entity-transfers, bulk-movements,
// profile changes, positions, process-settings, delegation,
// home/dashboard, manager-hub, search, and my-documents modules.
// ═══════════════════════════════════════════════════════════

import { ApiClient, type ApiResult } from './api-client'

// ─── Path Constants ──────────────────────────────────────

const LOA = '/api/v1/leave-of-absence'
const LOA_TYPES = '/api/v1/leave-of-absence/types'
const DISC = '/api/v1/disciplinary'
const REWARD = '/api/v1/rewards'
const BEN_POL = '/api/v1/benefits/policies'
const BEN_ENR = '/api/v1/benefits/enrollments'
const ENTITY = '/api/v1/entity-transfers'
const BULK = '/api/v1/bulk-movements'
const PROFILE = '/api/v1/profile/change-requests'
const POS = '/api/v1/positions'
const PROC_SET = '/api/v1/process-settings'
const HOME = '/api/v1/home'
const DASH = '/api/v1/dashboard'
const MGR_HUB = '/api/v1/manager-hub'
const SEARCH = '/api/v1/search'
const MY_DOCS = '/api/v1/my/documents'
const DELEG = '/api/v1/delegation'
const COMPANIES = '/api/v1/org/companies'

// ─── Uniqueness Helper ──────────────────────────────────

const ts = () => Date.now() % 100000

// ─── Date Helpers ────────────────────────────────────────

function futureDateStr(daysAhead: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString().split('T')[0] // date-only string YYYY-MM-DD
}

function pastDateStr(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

// ═══════════════════════════════════════════════════════════
// BUILDERS
// ═══════════════════════════════════════════════════════════

export function buildLoaType(prefix: string) {
  const t = ts()
  return {
    code: `E2E_LOA_${prefix}_${t}`,
    name: `E2E 휴직유형 ${prefix} ${t}`,
    nameEn: `E2E LOA Type ${prefix} ${t}`,
    category: 'CONTRACTUAL',
    maxDurationDays: 180,
    payType: 'UNPAID',
    requiresProof: false,
    reinstatementGuaranteed: true,
  }
}

export function buildLoaRecord(employeeId: string, typeId: string) {
  return {
    employeeId,
    typeId,
    startDate: futureDateStr(30),
    expectedEndDate: futureDateStr(120),
    reason: `E2E 테스트 휴직 사유 ${ts()}`,
  }
}

export function buildDisciplinary(employeeId: string) {
  return {
    employeeId,
    actionType: 'VERBAL_WARNING',
    category: 'ATTENDANCE',
    incidentDate: pastDateStr(7),
    description: `E2E 징계 사유 ${ts()}`,
  }
}

export function buildReward(employeeId: string) {
  return {
    employeeId,
    rewardType: 'COMMENDATION',
    title: `E2E 포상 ${ts()}`,
    description: `E2E 포상 설명 ${ts()}`,
    awardedDate: pastDateStr(3),
  }
}

export function buildBenefitPolicy() {
  const t = ts()
  return {
    name: `E2E 복리후생 ${t}`,
    category: 'HEALTH',
    frequency: 'MONTHLY',
    effectiveFrom: new Date().toISOString(),
    isTaxable: true,
  }
}

export function buildEntityTransfer(employeeId: string, toCompanyId: string) {
  return {
    employeeId,
    toCompanyId,
    transferType: 'PERMANENT_TRANSFER',
    transferDate: futureDateStr(60),
  }
}

export function buildProfileChangeRequest() {
  return {
    fieldName: 'phone',
    newValue: `010-9999-${ts()}`,
    reason: 'E2E 테스트 전화번호 변경',
  }
}

export function buildPosition(companyId: string) {
  const t = ts()
  return {
    titleKo: `E2E직위${t}`,
    titleEn: `E2E Position ${t}`,
    code: `E2E-POS-${t}`,
    companyId,
  }
}

export function buildDelegation(delegateeId: string) {
  return {
    delegateeId,
    scope: 'LEAVE_ONLY' as const,
    reason: `E2E 대결 사유 ${ts()}`,
    startDate: futureDateStr(30),
    endDate: futureDateStr(60),
  }
}

// ═══════════════════════════════════════════════════════════
// SEED RESOLVERS
// ═══════════════════════════════════════════════════════════

export async function resolveLoaType(c: ApiClient): Promise<{ id: string; code: string }> {
  const res = await c.get(LOA_TYPES)
  const types = ((res.data ?? res.body?.data) as Array<{ id: string; code: string }>) ?? []
  const found = types.find((t) => t.code !== undefined)
  if (!found) throw new Error('No seeded LOA type found')
  return { id: found.id, code: found.code }
}

export async function resolveCompanyIds(
  c: ApiClient,
): Promise<{ ctrId: string; ctrCnId: string }> {
  const res = await c.get(COMPANIES)
  const companies = ((res.data ?? res.body?.data) as Array<{ id: string; code: string }>) ?? []
  const ctr = companies.find((c) => c.code === 'CTR')
  const ctrCn = companies.find((c) => c.code === 'CTR-CN')
  if (!ctr || !ctrCn) throw new Error('CTR or CTR-CN company not found')
  return { ctrId: ctr.id, ctrCnId: ctrCn.id }
}

export async function resolveDisciplinaryId(c: ApiClient): Promise<string> {
  const res = await c.get(DISC)
  const items = ((res.data ?? res.body?.data) as Array<{ id: string }>) ?? []
  if (!items.length) throw new Error('No seeded disciplinary records')
  return items[0].id
}

// ═══════════════════════════════════════════════════════════
// LOA TYPES WRAPPERS
// ═══════════════════════════════════════════════════════════

export function listLoaTypes(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(LOA_TYPES, params)
}

export function createLoaType(c: ApiClient, data: ReturnType<typeof buildLoaType>): Promise<ApiResult> {
  return c.post(LOA_TYPES, data)
}

export function updateLoaType(c: ApiClient, id: string, data: Record<string, unknown>): Promise<ApiResult> {
  return c.put(`${LOA_TYPES}/${id}`, data)
}

export function deleteLoaType(c: ApiClient, id: string): Promise<ApiResult> {
  return c.del(`${LOA_TYPES}/${id}`)
}

export function applyLoaDefaults(c: ApiClient, data?: Record<string, unknown>): Promise<ApiResult> {
  return c.post(`${LOA_TYPES}/apply-defaults`, data ?? {})
}

// ═══════════════════════════════════════════════════════════
// LOA RECORDS WRAPPERS
// ═══════════════════════════════════════════════════════════

export function listLoaRecords(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(LOA, params)
}

export function createLoaRecord(c: ApiClient, data: ReturnType<typeof buildLoaRecord>): Promise<ApiResult> {
  return c.post(LOA, data)
}

export function getLoaRecord(c: ApiClient, id: string): Promise<ApiResult> {
  return c.get(`${LOA}/${id}`)
}

export function patchLoaAction(
  c: ApiClient,
  id: string,
  action: string,
  extra?: Record<string, unknown>,
): Promise<ApiResult> {
  return c.patch(`${LOA}/${id}`, { action, ...extra })
}

// ═══════════════════════════════════════════════════════════
// DISCIPLINE WRAPPERS
// ═══════════════════════════════════════════════════════════

export function listDisciplinary(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(DISC, params)
}

export function createDisciplinary(c: ApiClient, data: ReturnType<typeof buildDisciplinary>): Promise<ApiResult> {
  return c.post(DISC, data)
}

export function getDisciplinary(c: ApiClient, id: string): Promise<ApiResult> {
  return c.get(`${DISC}/${id}`)
}

export function updateDisciplinary(c: ApiClient, id: string, data: Record<string, unknown>): Promise<ApiResult> {
  return c.put(`${DISC}/${id}`, data)
}

export function appealDisciplinary(c: ApiClient, id: string, data: { appealText: string }): Promise<ApiResult> {
  return c.put(`${DISC}/${id}/appeal`, data)
}

// ═══════════════════════════════════════════════════════════
// REWARDS WRAPPERS
// ═══════════════════════════════════════════════════════════

export function listRewards(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(REWARD, params)
}

export function createReward(c: ApiClient, data: ReturnType<typeof buildReward>): Promise<ApiResult> {
  return c.post(REWARD, data)
}

export function getReward(c: ApiClient, id: string): Promise<ApiResult> {
  return c.get(`${REWARD}/${id}`)
}

export function updateReward(c: ApiClient, id: string, data: Record<string, unknown>): Promise<ApiResult> {
  return c.put(`${REWARD}/${id}`, data)
}

export function deleteReward(c: ApiClient, id: string): Promise<ApiResult> {
  return c.del(`${REWARD}/${id}`)
}

// ═══════════════════════════════════════════════════════════
// BENEFITS WRAPPERS
// ═══════════════════════════════════════════════════════════

export function listBenefitPolicies(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(BEN_POL, params)
}

export function createBenefitPolicy(c: ApiClient, data: ReturnType<typeof buildBenefitPolicy>): Promise<ApiResult> {
  return c.post(BEN_POL, data)
}

export function getBenefitPolicy(c: ApiClient, id: string): Promise<ApiResult> {
  return c.get(`${BEN_POL}/${id}`)
}

export function updateBenefitPolicy(c: ApiClient, id: string, data: Record<string, unknown>): Promise<ApiResult> {
  return c.put(`${BEN_POL}/${id}`, data)
}

export function listBenefitEnrollments(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(BEN_ENR, params)
}

export function createBenefitEnrollment(c: ApiClient, data: Record<string, unknown>): Promise<ApiResult> {
  return c.post(BEN_ENR, data)
}

// ═══════════════════════════════════════════════════════════
// ENTITY TRANSFERS WRAPPERS
// ═══════════════════════════════════════════════════════════

export function listEntityTransfers(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(ENTITY, params)
}

export function createEntityTransfer(c: ApiClient, data: ReturnType<typeof buildEntityTransfer>): Promise<ApiResult> {
  return c.post(ENTITY, data)
}

export function getEntityTransfer(c: ApiClient, id: string): Promise<ApiResult> {
  return c.get(`${ENTITY}/${id}`)
}

export function approveEntityTransfer(c: ApiClient, id: string, data: Record<string, unknown>): Promise<ApiResult> {
  return c.put(`${ENTITY}/${id}/approve`, data)
}

export function executeEntityTransfer(c: ApiClient, id: string): Promise<ApiResult> {
  return c.put(`${ENTITY}/${id}/execute`, {})
}

// ═══════════════════════════════════════════════════════════
// BULK MOVEMENTS WRAPPERS
// ═══════════════════════════════════════════════════════════

export function getBulkTemplate(c: ApiClient, type: string): Promise<ApiResult> {
  return c.get(`${BULK}/templates/${type}`)
}

// ═══════════════════════════════════════════════════════════
// PROFILE CHANGE REQUESTS WRAPPERS
// ═══════════════════════════════════════════════════════════

export function listProfileChangeRequests(c: ApiClient): Promise<ApiResult> {
  return c.get(PROFILE)
}

export function createProfileChangeRequest(c: ApiClient, data: ReturnType<typeof buildProfileChangeRequest>): Promise<ApiResult> {
  return c.post(PROFILE, data)
}

export function listPendingProfileChanges(c: ApiClient): Promise<ApiResult> {
  return c.get(`${PROFILE}/pending`)
}

export function reviewProfileChange(c: ApiClient, id: string, data: Record<string, unknown>): Promise<ApiResult> {
  return c.put(`${PROFILE}/${id}/review`, data)
}

// ═══════════════════════════════════════════════════════════
// POSITIONS WRAPPERS
// ═══════════════════════════════════════════════════════════

export function listPositions(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(POS, params)
}

export function createPosition(c: ApiClient, data: ReturnType<typeof buildPosition>): Promise<ApiResult> {
  return c.post(POS, data)
}

// ═══════════════════════════════════════════════════════════
// PROCESS SETTINGS WRAPPERS
// ═══════════════════════════════════════════════════════════

export function getProcessSettings(c: ApiClient, category: string, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${PROC_SET}/${category}`, params)
}

export function putProcessSettings(c: ApiClient, category: string, data: Record<string, unknown>): Promise<ApiResult> {
  return c.put(`${PROC_SET}/${category}`, data)
}

export function deleteProcessSettings(c: ApiClient, category: string, params?: Record<string, string>): Promise<ApiResult> {
  return c.del(`${PROC_SET}/${category}?${new URLSearchParams(params).toString()}`)
}

// ═══════════════════════════════════════════════════════════
// DELEGATION WRAPPERS
// ═══════════════════════════════════════════════════════════

export function listDelegations(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(DELEG, params)
}

export function getEligibleDelegatees(c: ApiClient): Promise<ApiResult> {
  return c.get(`${DELEG}/eligible`)
}

export function createDelegation(c: ApiClient, data: ReturnType<typeof buildDelegation>): Promise<ApiResult> {
  return c.post(DELEG, data)
}

export function revokeDelegation(c: ApiClient, id: string): Promise<ApiResult> {
  return c.put(`${DELEG}/${id}/revoke`, {})
}

// ═══════════════════════════════════════════════════════════
// HOME / DASHBOARD / MANAGER HUB WRAPPERS
// ═══════════════════════════════════════════════════════════

export function getHomeSummary(c: ApiClient): Promise<ApiResult> {
  return c.get(`${HOME}/summary`)
}

export function getPendingActions(c: ApiClient): Promise<ApiResult> {
  return c.get(`${HOME}/pending-actions`)
}

export function getDashboardSummary(c: ApiClient): Promise<ApiResult> {
  return c.get(`${DASH}/summary`)
}

export function getDashboardCompare(c: ApiClient): Promise<ApiResult> {
  return c.get(`${DASH}/compare`)
}

export function getManagerSummary(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${MGR_HUB}/summary`, params)
}

export function getManagerAlerts(c: ApiClient): Promise<ApiResult> {
  return c.get(`${MGR_HUB}/alerts`)
}

export function getManagerPendingApprovals(c: ApiClient): Promise<ApiResult> {
  return c.get(`${MGR_HUB}/pending-approvals`)
}

// ═══════════════════════════════════════════════════════════
// SEARCH WRAPPERS
// ═══════════════════════════════════════════════════════════

export function searchCommand(c: ApiClient, q: string): Promise<ApiResult> {
  return c.get(`${SEARCH}/command`, { q })
}

export function searchEmployees(c: ApiClient, search: string): Promise<ApiResult> {
  return c.get(`${SEARCH}/employees`, { search })
}

// ═══════════════════════════════════════════════════════════
// MY DOCUMENTS WRAPPERS
// ═══════════════════════════════════════════════════════════

export function listMyDocuments(c: ApiClient): Promise<ApiResult> {
  return c.get(MY_DOCS)
}

export function listCertificateRequests(c: ApiClient): Promise<ApiResult> {
  return c.get(`${MY_DOCS}/certificate-requests`)
}

// ═══════════════════════════════════════════════════════════
// COMPANIES WRAPPER (for entity transfer company discovery)
// ═══════════════════════════════════════════════════════════

export function listCompanies(c: ApiClient): Promise<ApiResult> {
  return c.get(COMPANIES)
}
