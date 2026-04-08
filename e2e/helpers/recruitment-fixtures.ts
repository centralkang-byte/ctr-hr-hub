// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Recruitment Test Helpers
// Thin wrappers around ApiClient for recruitment module tests.
// Covers: postings, applicants, applications, interviews,
//         requisitions, costs, talent pool, dashboard/board.
// ═══════════════════════════════════════════════════════════

import { ApiClient, type ApiResult, parseApiResponse } from './api-client'
import type { APIRequestContext } from '@playwright/test'

const API = '/api/v1/recruitment'

// ─── Postings ───────────────────────────────────────────

export function listPostings(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${API}/postings`, params)
}

export function createPosting(
  client: ApiClient,
  data: {
    title: string
    description: string
    employmentType: string
    headcount?: number
    departmentId?: string
    jobGradeId?: string
    recruiterId?: string
    location?: string
    salaryRangeMin?: number
    salaryRangeMax?: number
    workMode?: string
    deadlineDate?: string
  },
): Promise<ApiResult> {
  return client.post(`${API}/postings`, data)
}

export function getPosting(client: ApiClient, id: string): Promise<ApiResult> {
  return client.get(`${API}/postings/${id}`)
}

export function updatePosting(
  client: ApiClient,
  id: string,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  return client.put(`${API}/postings/${id}`, data)
}

export function deletePosting(client: ApiClient, id: string): Promise<ApiResult> {
  return client.del(`${API}/postings/${id}`)
}

export function publishPosting(client: ApiClient, id: string): Promise<ApiResult> {
  return client.put(`${API}/postings/${id}/publish`, {})
}

export function closePosting(client: ApiClient, id: string): Promise<ApiResult> {
  return client.put(`${API}/postings/${id}/close`, {})
}

// ─── Posting Applicants ─────────────────────────────────

export function listPostingApplicants(
  client: ApiClient,
  postingId: string,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${API}/postings/${postingId}/applicants`, params)
}

export function addApplicantToPosting(
  client: ApiClient,
  postingId: string,
  data: {
    name: string
    email: string
    phone?: string | null
    source?: string
    resumeKey?: string
  },
): Promise<ApiResult> {
  return client.post(`${API}/postings/${postingId}/applicants`, data)
}

// ─── Applicants ─────────────────────────────────────────

export function getApplicant(client: ApiClient, applicationId: string): Promise<ApiResult> {
  return client.get(`${API}/applicants/${applicationId}`)
}

export function updateApplicant(
  client: ApiClient,
  applicationId: string,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  return client.put(`${API}/applicants/${applicationId}`, data)
}

export function getApplicantTimeline(client: ApiClient, applicantId: string): Promise<ApiResult> {
  return client.get(`${API}/applicants/${applicantId}/timeline`)
}

export function checkDuplicate(
  client: ApiClient,
  data: { name?: string; email?: string; phone?: string },
): Promise<ApiResult> {
  return client.post(`${API}/applicants/check-duplicate`, data)
}

// ─── Applications ───────────────────────────────────────

export function changeStage(
  client: ApiClient,
  applicationId: string,
  data: { stage: string; rejectionReason?: string },
): Promise<ApiResult> {
  return client.put(`${API}/applications/${applicationId}/stage`, data)
}

export function sendOffer(
  client: ApiClient,
  applicationId: string,
  data: { offeredSalary: number; offeredDate: string; expectedStartDate: string },
): Promise<ApiResult> {
  return client.post(`${API}/applications/${applicationId}/offer`, data)
}

export async function respondOffer(
  request: APIRequestContext,
  applicationId: string,
  data: { response: 'ACCEPT' | 'DECLINE'; declineReason?: string },
): Promise<ApiResult> {
  const res = await request.fetch(`${API}/applications/${applicationId}/offer`, {
    method: 'PATCH',
    data,
  })
  return parseApiResponse(res)
}

// ─── Interviews ─────────────────────────────────────────

export function listInterviews(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${API}/interviews`, params)
}

export function createInterview(
  client: ApiClient,
  data: {
    applicationId: string
    interviewerId: string
    scheduledAt: string
    durationMinutes: number
    interviewType?: string
    round?: string
    location?: string
    meetingLink?: string
  },
): Promise<ApiResult> {
  return client.post(`${API}/interviews`, data)
}

export function getInterview(client: ApiClient, id: string): Promise<ApiResult> {
  return client.get(`${API}/interviews/${id}`)
}

export function updateInterview(
  client: ApiClient,
  id: string,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  return client.put(`${API}/interviews/${id}`, data)
}

export function deleteInterview(client: ApiClient, id: string): Promise<ApiResult> {
  return client.del(`${API}/interviews/${id}`)
}

export function evaluateInterview(
  client: ApiClient,
  id: string,
  data: {
    overallScore: number
    competencyScores?: Record<string, number>
    recommendation: string
    strengths?: string
    concerns?: string
    comment?: string
  },
): Promise<ApiResult> {
  return client.post(`${API}/interviews/${id}/evaluate`, data)
}

// ─── Requisitions ───────────────────────────────────────

export function listRequisitions(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${API}/requisitions`, params)
}

export function createRequisition(
  client: ApiClient,
  data: {
    companyId: string
    departmentId: string
    title: string
    headcount: number
    employmentType: string
    justification: string
    urgency?: string
    targetDate?: string
  },
): Promise<ApiResult> {
  return client.post(`${API}/requisitions`, data)
}

export function getRequisition(client: ApiClient, id: string): Promise<ApiResult> {
  return client.get(`${API}/requisitions/${id}`)
}

export async function updateRequisition(
  request: APIRequestContext,
  id: string,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  const res = await request.fetch(`${API}/requisitions/${id}`, {
    method: 'PATCH',
    data,
  })
  return parseApiResponse(res)
}

export function deleteRequisition(client: ApiClient, id: string): Promise<ApiResult> {
  return client.del(`${API}/requisitions/${id}`)
}

export function approveRequisition(
  client: ApiClient,
  id: string,
  data: { action: 'approve' | 'reject'; comment?: string },
): Promise<ApiResult> {
  return client.post(`${API}/requisitions/${id}/approve`, data)
}

// ─── Costs ──────────────────────────────────────────────

export function listCosts(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${API}/costs`, params)
}

export function createCost(
  client: ApiClient,
  data: {
    applicantSource: string
    costType: string
    amount: number
    currency?: string
    description?: string
    postingId?: string
  },
): Promise<ApiResult> {
  return client.post(`${API}/costs`, data)
}

export function getCost(client: ApiClient, id: string): Promise<ApiResult> {
  return client.get(`${API}/costs/${id}`)
}

export function updateCost(
  client: ApiClient,
  id: string,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  return client.put(`${API}/costs/${id}`, data)
}

export function deleteCost(client: ApiClient, id: string): Promise<ApiResult> {
  return client.del(`${API}/costs/${id}`)
}

// ─── Talent Pool ────────────────────────────────────────

export function listTalentPool(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${API}/talent-pool`, params)
}

export function addToTalentPool(
  client: ApiClient,
  data: {
    applicantId: string
    poolReason: string
    tags?: string[]
    consentGiven: boolean
    notes?: string
    sourcePostingId?: string
  },
): Promise<ApiResult> {
  return client.post(`${API}/talent-pool`, data)
}

export async function updateTalentPoolEntry(
  request: APIRequestContext,
  id: string,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  const res = await request.fetch(`${API}/talent-pool/${id}`, {
    method: 'PATCH',
    data,
  })
  return parseApiResponse(res)
}

// ─── Dashboard / Board / Analytics ──────────────────────

export function getDashboard(client: ApiClient): Promise<ApiResult> {
  return client.get(`${API}/dashboard`)
}

export function getBoard(client: ApiClient): Promise<ApiResult> {
  return client.get(`${API}/board`)
}

export function getCostAnalysis(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${API}/cost-analysis`, params)
}

export function getVacancies(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${API}/positions/vacancies`, params)
}

export function checkCandidate(
  client: ApiClient,
  params: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${API}/candidates/check`, params)
}

export function listInternalJobs(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${API}/internal-jobs`, params)
}

// ─── Seed Data Resolution ───────────────────────────────

/** Find the first OPEN KR posting from seed data */
export async function resolveSeedPosting(client: ApiClient) {
  const res = await listPostings(client, { status: 'OPEN', limit: '5' })
  const items = res.data as Array<Record<string, unknown>> | undefined
  if (!items?.length) throw new Error('No OPEN seed postings found')
  return items[0]
}

/** Find the first APPLIED application for a given posting */
export async function resolveSeedApplication(client: ApiClient, postingId: string) {
  const res = await listPostingApplicants(client, postingId, { limit: '50' })
  const items = res.data as Array<Record<string, unknown>> | undefined
  if (!items?.length) throw new Error(`No applicants found for posting ${postingId}`)
  // Find one in APPLIED stage for stage-transition tests
  const applied = items.find((a) => a.stage === 'APPLIED')
  return applied ?? items[0]
}

// ─── Test Data Builders ─────────────────────────────────

/** DRAFT posting payload — publish requires departmentId + jobGradeId + recruiterId */
export function buildPosting(prefix: string) {
  return {
    title: `E2E ${prefix} 채용공고 ${Date.now()}`,
    description: `E2E 테스트용 채용공고 설명 (${prefix})`,
    employmentType: 'FULL_TIME' as const,
    headcount: 1,
  }
}

/** New applicant to add to a posting */
export function buildApplicant(prefix: string) {
  return {
    name: `테스트지원자-${prefix}-${Date.now()}`,
    email: `e2e-${prefix}-${Date.now()}@test.local`,
    phone: null as string | null,
    source: 'DIRECT' as const,
  }
}

/** Interview schedule (future date) — requires applicationId + interviewerId */
export function buildInterview(applicationId: string, interviewerId: string) {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  return {
    applicationId,
    interviewerId,
    scheduledAt: future.toISOString(),
    durationMinutes: 60,
    interviewType: 'VIDEO' as const,
    round: 'FIRST' as const,
  }
}

/** Requisition draft — requires companyId + departmentId */
export function buildRequisition(companyId: string, departmentId: string) {
  return {
    companyId,
    departmentId,
    title: `E2E 채용요청 ${Date.now()}`,
    headcount: 1,
    employmentType: 'permanent',
    justification: 'E2E 테스트 채용 사유',
    urgency: 'normal',
  }
}

/** Recruitment cost record */
export function buildCost(prefix: string) {
  return {
    applicantSource: 'DIRECT' as const,
    costType: 'AD_FEE' as const,
    amount: 500000,
    currency: 'KRW',
    description: `E2E cost ${prefix} ${Date.now()}`,
  }
}

/** Talent pool entry — requires applicantId */
export function buildTalentPoolEntry(applicantId: string) {
  return {
    applicantId,
    poolReason: 'rejected_qualified' as const,
    tags: ['e2e-test'],
    consentGiven: true,
    notes: 'E2E test talent pool entry',
  }
}

/** Interview evaluation */
export function buildEvaluation() {
  return {
    overallScore: 4,
    competencyScores: { communication: 4, technical: 3, teamwork: 5 },
    recommendation: 'YES' as const,
    strengths: 'E2E 테스트 강점 평가',
    comment: 'E2E test evaluation comment',
  }
}

/** Helper: ISO datetime string N days in the future */
export function futureDateStr(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}
