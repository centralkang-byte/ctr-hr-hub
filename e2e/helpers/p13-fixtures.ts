// ═══════════════════════════════════════════════════════════
// CTR HR Hub — P13 Test Helpers
// AI endpoints, HR Chat, Performance Compensation/Results/
// Reviews/Checkins/TeamGoals, Peer Review deeper,
// Analytics deeper, Compliance deeper, Org Restructure
// ═══════════════════════════════════════════════════════════

import { ApiClient, type ApiResult } from './api-client'
import type { APIRequestContext } from '@playwright/test'
import { parseApiResponse } from './api-client'

// ─── Path Constants ──────────────────────────────────────

// AI endpoints (all POST)
const AI_BASE = '/api/v1/ai'

// HR Chat
const HR_CHAT_SESSIONS = '/api/v1/hr-chat/sessions'
const HR_CHAT_MESSAGES = '/api/v1/hr-chat/messages'

// Performance — Compensation Pipeline
const PERF_COMP = '/api/v1/performance/compensation'

// Performance — Results
const PERF_RESULTS_ADMIN = '/api/v1/performance/results/admin'
const PERF_RESULTS_ME = '/api/v1/performance/results/me'
const PERF_RESULTS_TEAM = '/api/v1/performance/results/team'

// Performance — Reviews deeper
const PERF_REVIEWS = '/api/v1/performance/reviews'

// Performance — Checkins
const PERF_CHECKINS = '/api/v1/performance/checkins'

// Performance — Team Goals
const PERF_TEAM_GOALS = '/api/v1/performance/team-goals'

// Performance — Peer Review deeper
const PEER_REVIEW_CANDIDATES = '/api/v1/performance/peer-review/candidates'
const PEER_REVIEW_SUBMIT = '/api/v1/performance/peer-review/submit'

// Analytics
const ANALYTICS_PREDICTION_BURNOUT = '/api/v1/analytics/prediction/burnout'
const ANALYTICS_PREDICTION_TURNOVER = '/api/v1/analytics/prediction/turnover'
const ANALYTICS_TURNOVER = '/api/v1/analytics/turnover'
const ANALYTICS_TURNOVER_OVERVIEW = '/api/v1/analytics/turnover/overview'
const ANALYTICS_TURNOVER_RISK = '/api/v1/analytics/turnover-risk'
const ANALYTICS_TEAM_HEALTH = '/api/v1/analytics/team-health'
const ANALYTICS_TEAM_HEALTH_OVERVIEW = '/api/v1/analytics/team-health/overview'
const ANALYTICS_TEAM_STATS = '/api/v1/analytics/team-stats'
const ANALYTICS_PERFORMANCE = '/api/v1/analytics/performance'
const ANALYTICS_PERFORMANCE_OVERVIEW = '/api/v1/analytics/performance/overview'
const ANALYTICS_GENDER_PAY_GAP = '/api/v1/analytics/gender-pay-gap'
const ANALYTICS_GENDER_PAY_GAP_EXPORT = '/api/v1/analytics/gender-pay-gap/export'
const ANALYTICS_AI_REPORT = '/api/v1/analytics/ai-report'
const ANALYTICS_AI_REPORT_GENERATE = '/api/v1/analytics/ai-report/generate'

// Compliance — GDPR
const GDPR_PII_ACCESS = '/api/v1/compliance/gdpr/pii-access'
const GDPR_PII_DASHBOARD = '/api/v1/compliance/gdpr/pii-access/dashboard'
const GDPR_RETENTION = '/api/v1/compliance/gdpr/retention'
const GDPR_RETENTION_RUN = '/api/v1/compliance/gdpr/retention/run'
const GDPR_REQUESTS = '/api/v1/compliance/gdpr/requests'

// Compliance — KR
const KR_SEVERANCE = '/api/v1/compliance/kr/severance-interim'
const KR_SEVERANCE_CALCULATE = '/api/v1/compliance/kr/severance-interim/calculate'

// Compliance — CN
const CN_SOCIAL_INSURANCE_CALC = '/api/v1/compliance/cn/social-insurance/calculate'
const CN_SOCIAL_INSURANCE_EXPORT = '/api/v1/compliance/cn/social-insurance/export'
const CN_EMPLOYEE_REGISTRY_EXPORT = '/api/v1/compliance/cn/employee-registry/export'

// Compliance — RU
const RU_KEDO = '/api/v1/compliance/ru/kedo'
const RU_MILITARY_EXPORT_T2 = '/api/v1/compliance/ru/military/export/t2'
const RU_REPORTS_57T = '/api/v1/compliance/ru/reports/57t'
const RU_REPORTS_P4 = '/api/v1/compliance/ru/reports/p4'

// Org Restructure
const ORG_RESTRUCTURE = '/api/v1/org/restructure-plans'

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
 * Resolve a performance cycle ID. Re-uses logic from p10.
 */
export async function resolveCycleId(request: APIRequestContext): Promise<string | undefined> {
  const res = await request.get('/api/v1/performance/cycles')
  const { ok, data } = await parseApiResponse(res)
  if (ok && Array.isArray(data) && data.length > 0) {
    return (data[0] as { id: string }).id
  }
  return undefined
}

/**
 * Resolve an employee ID (이민준).
 */
export async function resolveEmployeeId(request: APIRequestContext): Promise<string | undefined> {
  const res = await request.get('/api/v1/employees?search=이민준&page=1&limit=1')
  const { ok, data } = await parseApiResponse(res)
  if (ok && Array.isArray(data) && data.length > 0) {
    return (data[0] as { id: string }).id
  }
  return undefined
}

/**
 * Resolve company ID from employee assignment.
 */
export async function resolveCompanyId(request: APIRequestContext): Promise<string | undefined> {
  const res = await request.get('/api/v1/employees?search=이민준&page=1&limit=1')
  const { ok, data } = await parseApiResponse(res)
  if (ok && Array.isArray(data) && data.length > 0) {
    const emp = data[0] as { assignments?: Array<{ companyId?: string; isPrimary?: boolean; endDate?: string | null }> }
    const primary = emp.assignments?.find((a) => a.isPrimary && !a.endDate)
    return primary?.companyId
  }
  return undefined
}

/**
 * Resolve a review ID from the first available review in a cycle.
 */
export async function resolveReviewId(c: ApiClient, cycleId: string): Promise<string | undefined> {
  const res = await c.get(PERF_RESULTS_ADMIN, { cycleId, page: '1', limit: '1' })
  if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
    return (res.data[0] as { reviewId?: string; id?: string }).reviewId ?? (res.data[0] as { id: string }).id
  }
  return undefined
}

// ═══════════════════════════════════════════════════════════
// BUILDERS — AI Endpoints
// ═══════════════════════════════════════════════════════════

export function buildCalibrationRequest() {
  return {
    sessionName: `E2E Calibration ${ts()}`,
    departmentName: 'Engineering',
    evaluations: [
      {
        employeeName: 'E2E Employee A',
        performanceScore: 4.2,
        competencyScore: 3.8,
        emsBlock: 'EXCEEDS',
        selfScore: 4.0,
        managerScore: 4.5,
      },
    ],
    blockDistribution: { EXCEEDS: 1, MEETS: 0, BELOW: 0 },
  }
}

export function buildEvalCommentRequest() {
  return {
    employeeName: 'E2E Employee A',
    goalSummary: 'Q1 목표 달성률 95%',
    goalScores: [{ title: '매출 달성', score: 4, weight: 60 }],
    competencyScores: [{ name: '리더십', score: 4 }],
    evalType: 'MANAGER' as const,
  }
}

export function buildExecutiveReportRequest(companyId?: string) {
  return {
    company_id: companyId ?? null,
  }
}

export function buildJobDescriptionRequest() {
  return {
    title: `E2E Software Engineer ${ts()}`,
    department: 'Engineering',
    grade: 'S3',
    category: 'Technology',
    requirements: '3+ years experience in TypeScript',
  }
}

export function buildOnboardingCheckinSummaryRequest(employeeId: string) {
  return { employeeId }
}

export function buildOneOnOneNotesRequest(meetingId: string) {
  return {
    meetingId,
    currentNotes: 'E2E test meeting notes — discuss performance goals.',
  }
}

export function buildPayrollAnomalyRequest(runId?: string) {
  return { runId: runId ?? '00000000-0000-4000-a000-000000000099' }
}

export function buildPeerReviewSummaryRequest(cycleId: string, employeeId: string) {
  return { cycleId, employeeId }
}

export function buildPulseAnalysisRequest(surveyId?: string) {
  return { surveyId: surveyId ?? '00000000-0000-4000-a000-000000000099' }
}

export function buildResumeAnalysisRequest() {
  return {
    resumeText: 'Experienced software engineer with 5 years in TypeScript and React.',
    jobTitle: 'Senior Frontend Developer',
    requirements: '5+ years experience in React',
    preferred: 'Next.js experience',
  }
}

// ═══════════════════════════════════════════════════════════
// BUILDERS — HR Chat
// ═══════════════════════════════════════════════════════════

export function buildChatSession() {
  return { title: `E2E Chat ${ts()}` }
}

export function buildChatMessage() {
  return { content: '연차 신청 방법을 알려주세요.' }
}

export function buildChatFeedback() {
  return { feedback: 'HELPFUL' as const }
}

// ═══════════════════════════════════════════════════════════
// BUILDERS — Performance Compensation
// ═══════════════════════════════════════════════════════════

export function buildCompensationApply(employeeId: string, appliedPct: number, exceptionReason?: string) {
  return {
    adjustments: [
      {
        employeeId,
        appliedPct,
        ...(exceptionReason ? { exceptionReason } : {}),
      },
    ],
  }
}

export function buildCompensationApprove(acknowledgeExceptions = false) {
  return {
    acknowledgeExceptions,
    approverComment: 'E2E approval',
  }
}

// ═══════════════════════════════════════════════════════════
// BUILDERS — Peer Review Deeper
// ═══════════════════════════════════════════════════════════

export function buildPeerReviewSubmit(nominationId: string) {
  return {
    nominationId,
    scoreChallenge: 4,
    scoreTrust: 4,
    scoreResponsibility: 3,
    scoreRespect: 5,
    commentChallenge: 'E2E test',
    commentTrust: 'E2E test',
    commentResponsibility: 'E2E test',
    commentRespect: 'E2E test',
    overallComment: 'E2E overall peer review comment',
  }
}

// ═══════════════════════════════════════════════════════════
// BUILDERS — Analytics
// ═══════════════════════════════════════════════════════════

export function buildAiReportGenerate(companyId?: string) {
  const now = new Date()
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return { companyId: companyId ?? null, period }
}

// ═══════════════════════════════════════════════════════════
// BUILDERS — Compliance
// ═══════════════════════════════════════════════════════════

export function buildRetentionPolicy() {
  const t = ts()
  return {
    category: 'EMPLOYMENT',
    dataType: `E2E_DATA_${t}`,
    retentionDays: 365,
    description: `E2E retention policy ${t}`,
    isActive: true,
  }
}

export function buildGdprRequest(employeeId: string) {
  return {
    employeeId,
    requestType: 'ACCESS' as const,
    description: `E2E DSAR request ${ts()}`,
  }
}

export function buildSeveranceCreate(employeeId: string) {
  return {
    employeeId,
    reason: 'HOUSING',
    requestedAmount: 5000000,
    notes: `E2E severance interim ${ts()}`,
  }
}

export function buildSocialInsuranceCalc() {
  const now = new Date()
  return {
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  }
}

export function buildKedoSign() {
  return {
    signatureData: 'e2e-signature-hash-data',
    signedAt: new Date().toISOString(),
  }
}

export function buildKedoReject() {
  return {
    reason: 'E2E test rejection reason',
  }
}

// ═══════════════════════════════════════════════════════════
// BUILDERS — Org Restructure
// ═══════════════════════════════════════════════════════════

export function buildRestructurePlan(companyId: string) {
  const t = ts()
  return {
    companyId,
    title: `E2E Restructure Plan ${t}`,
    description: `E2E test org restructure plan ${t}`,
    effectiveDate: futureDateStr(30),
    changes: [{ type: 'rename', id: `change-${t}`, deptId: '00000000-0000-4000-a000-000000000001', newDeptName: `E2E Dept ${t}` }],
    status: 'draft' as const,
  }
}

export function buildRestructureUpdate() {
  return {
    description: `Updated description ${ts()}`,
    status: 'review' as const,
  }
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — AI Endpoints (all POST, smoke-test style)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function postAi(c: ApiClient, endpoint: string, data: Record<string, unknown>): Promise<ApiResult<any>> {
  return c.post(`${AI_BASE}/${endpoint}`, data)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — HR Chat
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listSessions(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(HR_CHAT_SESSIONS)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSession(c: ApiClient, data: ReturnType<typeof buildChatSession>): Promise<ApiResult<any>> {
  return c.post(HR_CHAT_SESSIONS, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMessages(c: ApiClient, sessionId: string): Promise<ApiResult<any>> {
  return c.get(`${HR_CHAT_SESSIONS}/${sessionId}/messages`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function postMessage(c: ApiClient, sessionId: string, data: ReturnType<typeof buildChatMessage>): Promise<ApiResult<any>> {
  return c.post(`${HR_CHAT_SESSIONS}/${sessionId}/messages`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function escalateMessage(c: ApiClient, messageId: string): Promise<ApiResult<any>> {
  return c.post(`${HR_CHAT_MESSAGES}/${messageId}/escalate`, {})
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function feedbackMessage(c: ApiClient, messageId: string, data: ReturnType<typeof buildChatFeedback>): Promise<ApiResult<any>> {
  return c.put(`${HR_CHAT_MESSAGES}/${messageId}/feedback`, data)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Performance Compensation Pipeline
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCompDashboard(c: ApiClient, cycleId: string): Promise<ApiResult<any>> {
  return c.get(`${PERF_COMP}/${cycleId}/dashboard`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCompRecommendations(c: ApiClient, cycleId: string): Promise<ApiResult<any>> {
  return c.get(`${PERF_COMP}/${cycleId}/recommendations`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyCompensation(c: ApiClient, cycleId: string, data: ReturnType<typeof buildCompensationApply>): Promise<ApiResult<any>> {
  return c.put(`${PERF_COMP}/${cycleId}/apply`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function approveCompensation(c: ApiClient, cycleId: string, data: ReturnType<typeof buildCompensationApprove>): Promise<ApiResult<any>> {
  return c.post(`${PERF_COMP}/${cycleId}/approve`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCompExport(c: ApiClient, cycleId: string): Promise<ApiResult<any>> {
  return c.get(`${PERF_COMP}/${cycleId}/export`)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Performance Results
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getResultsAdmin(c: ApiClient, params: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(PERF_RESULTS_ADMIN, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getResultsMe(c: ApiClient, params: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(PERF_RESULTS_ME, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getResultsTeam(c: ApiClient, params: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(PERF_RESULTS_TEAM, params)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Performance Reviews Deeper
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function acknowledgeReview(c: ApiClient, reviewId: string): Promise<ApiResult<any>> {
  return c.post(`${PERF_REVIEWS}/${reviewId}/acknowledge`, {})
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function notifyReview(c: ApiClient, reviewId: string): Promise<ApiResult<any>> {
  return c.post(`${PERF_REVIEWS}/${reviewId}/notify`, {})
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getOverdue(c: ApiClient, reviewId: string): Promise<ApiResult<any>> {
  return c.get(`${PERF_REVIEWS}/${reviewId}/overdue`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMyHistory(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(`${PERF_REVIEWS}/my-history`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMyResult(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(`${PERF_REVIEWS}/my-result`, params)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Performance Checkins & Team Goals
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function postCheckin(c: ApiClient, data: Record<string, unknown>): Promise<ApiResult<any>> {
  return c.post(PERF_CHECKINS, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCheckinStatus(c: ApiClient, cycleId: string): Promise<ApiResult<any>> {
  return c.get(`${PERF_CHECKINS}/${cycleId}/status`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTeamGoals(c: ApiClient, params: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(PERF_TEAM_GOALS, params)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Peer Review Deeper
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPeerCandidates(c: ApiClient, params: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(PEER_REVIEW_CANDIDATES, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function submitPeerReview(c: ApiClient, data: ReturnType<typeof buildPeerReviewSubmit>): Promise<ApiResult<any>> {
  return c.post(PEER_REVIEW_SUBMIT, data)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Analytics Prediction
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPredictionBurnout(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(ANALYTICS_PREDICTION_BURNOUT, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPredictionTurnover(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(ANALYTICS_PREDICTION_TURNOVER, params)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Analytics Turnover & Team
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTurnover(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(ANALYTICS_TURNOVER, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTurnoverOverview(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(ANALYTICS_TURNOVER_OVERVIEW, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTurnoverRisk(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(ANALYTICS_TURNOVER_RISK, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTeamHealth(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(ANALYTICS_TEAM_HEALTH, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTeamHealthOverview(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(ANALYTICS_TEAM_HEALTH_OVERVIEW, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTeamStats(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(ANALYTICS_TEAM_STATS, params)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Analytics Performance & Gender Pay Gap
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAnalyticsPerformance(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(ANALYTICS_PERFORMANCE, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAnalyticsPerformanceOverview(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(ANALYTICS_PERFORMANCE_OVERVIEW, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getGenderPayGap(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(ANALYTICS_GENDER_PAY_GAP, params)
}

export function getGenderPayGapExport(c: ApiClient, params?: Record<string, string>) {
  return c.getRaw(ANALYTICS_GENDER_PAY_GAP_EXPORT, params)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Analytics AI Report
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAiReport(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(ANALYTICS_AI_REPORT, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateAiReport(c: ApiClient, data: ReturnType<typeof buildAiReportGenerate>): Promise<ApiResult<any>> {
  return c.post(ANALYTICS_AI_REPORT_GENERATE, data)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — GDPR
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPiiAccess(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(GDPR_PII_ACCESS, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPiiDashboard(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(GDPR_PII_DASHBOARD)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listRetention(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(GDPR_RETENTION, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createRetention(c: ApiClient, data: ReturnType<typeof buildRetentionPolicy>): Promise<ApiResult<any>> {
  return c.post(GDPR_RETENTION, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateRetention(c: ApiClient, id: string, data: Record<string, unknown>): Promise<ApiResult<any>> {
  return c.put(`${GDPR_RETENTION}/${id}`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function runRetention(c: ApiClient): Promise<ApiResult<any>> {
  return c.post(GDPR_RETENTION_RUN, {})
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listGdprRequests(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(GDPR_REQUESTS, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGdprRequest(c: ApiClient, data: ReturnType<typeof buildGdprRequest>): Promise<ApiResult<any>> {
  return c.post(GDPR_REQUESTS, data)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Compliance KR
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listSeverance(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(KR_SEVERANCE, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSeverance(c: ApiClient, data: ReturnType<typeof buildSeveranceCreate>): Promise<ApiResult<any>> {
  return c.post(KR_SEVERANCE, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSeveranceDetail(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${KR_SEVERANCE}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function calculateSeverance(c: ApiClient, params: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(KR_SEVERANCE_CALCULATE, params)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Compliance CN
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function calcSocialInsurance(c: ApiClient, data: ReturnType<typeof buildSocialInsuranceCalc>): Promise<ApiResult<any>> {
  return c.post(CN_SOCIAL_INSURANCE_CALC, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportSocialInsurance(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(CN_SOCIAL_INSURANCE_EXPORT, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportEmployeeRegistry(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(CN_EMPLOYEE_REGISTRY_EXPORT, params)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Compliance RU
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function signKedo(c: ApiClient, id: string, data: ReturnType<typeof buildKedoSign>): Promise<ApiResult<any>> {
  return c.post(`${RU_KEDO}/${id}/sign`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rejectKedo(c: ApiClient, id: string, data: ReturnType<typeof buildKedoReject>): Promise<ApiResult<any>> {
  return c.post(`${RU_KEDO}/${id}/reject`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMilitaryExportT2(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(RU_MILITARY_EXPORT_T2)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getReport57T(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(RU_REPORTS_57T, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getReportP4(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(RU_REPORTS_P4, params)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Org Restructure
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listRestructurePlans(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(ORG_RESTRUCTURE, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createRestructurePlan(c: ApiClient, data: ReturnType<typeof buildRestructurePlan>): Promise<ApiResult<any>> {
  return c.post(ORG_RESTRUCTURE, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRestructurePlan(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${ORG_RESTRUCTURE}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateRestructurePlan(c: ApiClient, id: string, data: Record<string, unknown>): Promise<ApiResult<any>> {
  return c.patch(`${ORG_RESTRUCTURE}/${id}`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyRestructurePlan(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.post(`${ORG_RESTRUCTURE}/${id}/apply`, {})
}
