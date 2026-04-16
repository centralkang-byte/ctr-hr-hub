// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Performance Module Test Helpers
// Thin wrappers around ApiClient for performance, CFR, pulse.
// Covers: goals, peer-review, 1:1, recognition, pulse, results,
//         checkins, calibration extras.
// ═══════════════════════════════════════════════════════════

import { ApiClient, type ApiResult } from './api-client'

const PERF = '/api/v1/performance'
const CFR = '/api/v1/cfr'
const PULSE = '/api/v1/pulse'

// ─── Goals ───────────────────────────────────────────────

export function listGoals(
  client: ApiClient,
  cycleId: string,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${PERF}/goals`, { cycleId, ...params })
}

export function createGoal(
  client: ApiClient,
  data: {
    cycleId: string
    title: string
    weight: number
    description?: string
    targetMetric?: string
    targetValue?: string
  },
): Promise<ApiResult> {
  return client.post(`${PERF}/goals`, data)
}

export function getGoal(client: ApiClient, id: string): Promise<ApiResult> {
  return client.get(`${PERF}/goals/${id}`)
}

export function updateGoal(
  client: ApiClient,
  id: string,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  return client.put(`${PERF}/goals/${id}`, data)
}

export function submitGoal(client: ApiClient, id: string): Promise<ApiResult> {
  return client.put(`${PERF}/goals/${id}/submit`, {})
}

export function approveGoal(client: ApiClient, id: string): Promise<ApiResult> {
  return client.put(`${PERF}/goals/${id}/approve`, {})
}

export function unlockGoal(client: ApiClient, id: string): Promise<ApiResult> {
  return client.post(`${PERF}/goals/${id}/unlock`, {})
}

export function requestRevision(
  client: ApiClient,
  id: string,
  data?: { reason?: string },
): Promise<ApiResult> {
  return client.put(`${PERF}/goals/${id}/request-revision`, data ?? {})
}

export function addProgress(
  client: ApiClient,
  goalId: string,
  data: { progressPct: number; note?: string },
): Promise<ApiResult> {
  return client.post(`${PERF}/goals/${goalId}/progress`, data)
}

export function listProgress(client: ApiClient, goalId: string): Promise<ApiResult> {
  return client.get(`${PERF}/goals/${goalId}/progress`)
}

export function bulkLockGoals(
  client: ApiClient,
  data: { cycleId: string },
): Promise<ApiResult> {
  return client.post(`${PERF}/goals/bulk-lock`, data)
}

export function getTeamGoals(
  client: ApiClient,
  cycleId: string,
): Promise<ApiResult> {
  return client.get(`${PERF}/team-goals`, { cycleId })
}

// ─── Peer Review ────────────────────────────────────────

export function getCandidates(
  client: ApiClient,
  cycleId: string,
  employeeId?: string,
): Promise<ApiResult> {
  const params: Record<string, string> = { cycleId }
  if (employeeId) params.employeeId = employeeId
  return client.get(`${PERF}/peer-review/candidates`, params)
}

export function nominate(
  client: ApiClient,
  data: { cycleId: string; employeeId: string; nomineeIds: string[] },
): Promise<ApiResult> {
  return client.post(`${PERF}/peer-review/nominate`, data)
}

export function submitPeerReview(
  client: ApiClient,
  data: {
    nominationId: string
    scoreChallenge: number
    scoreTrust: number
    scoreResponsibility: number
    scoreRespect: number
    overallComment: string
    status?: 'DRAFT' | 'SUBMITTED'
  },
): Promise<ApiResult> {
  return client.post(`${PERF}/peer-review/submit`, { status: 'SUBMITTED', ...data })
}

export function getMyAssignments(client: ApiClient): Promise<ApiResult> {
  return client.get(`${PERF}/peer-review/my-assignments`)
}

export function getPeerResults(
  client: ApiClient,
  employeeId: string,
): Promise<ApiResult> {
  return client.get(`${PERF}/peer-review/results/${employeeId}`)
}

export function skipNomination(
  client: ApiClient,
  nominationId: string,
): Promise<ApiResult> {
  return client.put(`${PERF}/peer-review/nominations/${nominationId}/skip`, {})
}

// ─── CFR: One-on-Ones ──────────────────────────────────

export function listOneOnOnes(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${CFR}/one-on-ones`, params)
}

export function createOneOnOne(
  client: ApiClient,
  data: {
    employeeId: string
    scheduledAt: string
    meetingType?: string
    agenda?: string
  },
): Promise<ApiResult> {
  return client.post(`${CFR}/one-on-ones`, { meetingType: 'REGULAR', ...data })
}

export function getOneOnOne(client: ApiClient, id: string): Promise<ApiResult> {
  return client.get(`${CFR}/one-on-ones/${id}`)
}

export function updateOneOnOne(
  client: ApiClient,
  id: string,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  return client.put(`${CFR}/one-on-ones/${id}`, data)
}

export function getOneOnOneDashboard(client: ApiClient): Promise<ApiResult> {
  return client.get(`${CFR}/one-on-ones/dashboard`)
}

// ─── CFR: Recognition ──────────────────────────────────

export function listRecognitions(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${CFR}/recognitions`, params)
}

export function createRecognition(
  client: ApiClient,
  data: {
    receiverId: string
    coreValue: 'CHALLENGE' | 'TRUST' | 'RESPONSIBILITY' | 'RESPECT'
    message: string
    isPublic?: boolean
  },
): Promise<ApiResult> {
  return client.post(`${CFR}/recognitions`, { isPublic: true, ...data })
}

export function likeRecognition(client: ApiClient, id: string): Promise<ApiResult> {
  return client.post(`${CFR}/recognitions/${id}/like`, {})
}

export function getRecognitionStats(client: ApiClient): Promise<ApiResult> {
  return client.get(`${CFR}/recognitions/stats`)
}

export function getEmployeeRecognitions(
  client: ApiClient,
  employeeId: string,
): Promise<ApiResult> {
  return client.get(`${CFR}/recognitions/employee/${employeeId}`)
}

// ─── Pulse Surveys ─────────────────────────────────────

export function listSurveys(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${PULSE}/surveys`, params)
}

export function createSurvey(
  client: ApiClient,
  data: {
    title: string
    description?: string
    targetScope: string
    targetIds?: string[]
    anonymityLevel: string
    minRespondentsForReport?: number
    openAt: string
    closeAt: string
    questions: Array<{
      questionText: string
      questionType: string
      sortOrder: number
      isRequired?: boolean
      options?: unknown
    }>
  },
): Promise<ApiResult> {
  return client.post(`${PULSE}/surveys`, data)
}

export function getSurvey(client: ApiClient, id: string): Promise<ApiResult> {
  return client.get(`${PULSE}/surveys/${id}`)
}

export function updateSurvey(
  client: ApiClient,
  id: string,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  return client.put(`${PULSE}/surveys/${id}`, data)
}

export function deleteSurvey(client: ApiClient, id: string): Promise<ApiResult> {
  return client.del(`${PULSE}/surveys/${id}`)
}

export function respondToSurvey(
  client: ApiClient,
  surveyId: string,
  data: { answers: Array<{ questionId: string; value: unknown }> },
): Promise<ApiResult> {
  return client.post(`${PULSE}/surveys/${surveyId}/respond`, data)
}

export function getSurveyResults(client: ApiClient, surveyId: string): Promise<ApiResult> {
  return client.get(`${PULSE}/surveys/${surveyId}/results`)
}

export function getMyPendingSurveys(client: ApiClient): Promise<ApiResult> {
  return client.get(`${PULSE}/my-pending`)
}

export function updateSurveyQuestions(
  client: ApiClient,
  surveyId: string,
  data: { questions: Array<{ questionText: string; questionType: string; sortOrder: number; isRequired?: boolean }> },
): Promise<ApiResult> {
  return client.put(`${PULSE}/surveys/${surveyId}/questions`, data)
}

// ─── Results & Reviews ─────────────────────────────────

export function getAdminResults(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${PERF}/results/admin`, params)
}

export function getTeamResults(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${PERF}/results/team`, params)
}

export function getMyResults(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${PERF}/results/me`, params)
}

export function getMyReviewResult(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${PERF}/reviews/my-result`, params)
}

export function getMyHistory(client: ApiClient): Promise<ApiResult> {
  return client.get(`${PERF}/reviews/my-history`)
}

export function acknowledgeReview(
  client: ApiClient,
  reviewId: string,
): Promise<ApiResult> {
  return client.post(`${PERF}/reviews/${reviewId}/acknowledge`, {})
}

export function notifyReview(
  client: ApiClient,
  reviewId: string,
): Promise<ApiResult> {
  return client.post(`${PERF}/reviews/${reviewId}/notify`, {})
}

export function getOverdueReviews(
  client: ApiClient,
  reviewId: string,
): Promise<ApiResult> {
  return client.get(`${PERF}/reviews/${reviewId}/overdue`)
}

// ─── Checkins ──────────────────────────────────────────

export function createCheckin(
  client: ApiClient,
  data: { cycleId: string; content: string; type: 'MANAGER' | 'EMPLOYEE'; employeeId?: string },
): Promise<ApiResult> {
  return client.post(`${PERF}/checkins`, data)
}

export function getCheckinStatus(
  client: ApiClient,
  cycleId: string,
): Promise<ApiResult> {
  return client.get(`${PERF}/checkins/${cycleId}/status`)
}

// ─── Calibration Extras ────────────────────────────────

export function listCalibrationSessions(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${PERF}/calibration/sessions`, params)
}

export function getCalibrationRules(client: ApiClient): Promise<ApiResult> {
  return client.get(`${PERF}/calibration/rules`)
}

export function getDistribution(
  client: ApiClient,
  sessionId: string,
): Promise<ApiResult> {
  return client.get(`${PERF}/calibration/${sessionId}/distribution`)
}

export function singleAdjust(
  client: ApiClient,
  sessionId: string,
  data: {
    evaluationId: string
    newEmsBlock: string
    reason: string
  },
): Promise<ApiResult> {
  return client.put(`${PERF}/calibration/${sessionId}/adjust`, data)
}

// ─── Test Data Builders ────────────────────────────────

export function buildGoal(cycleId: string, idx = 1) {
  const ts = Date.now()
  return {
    cycleId,
    title: `E2E Goal ${idx} ${ts}`,
    weight: idx === 1 ? 60 : 40,
    description: `E2E test goal description (${ts})`,
    targetMetric: 'completion_rate',
    targetValue: '100%',
  }
}

export function buildOneOnOne(employeeId: string) {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  return {
    employeeId,
    scheduledAt: future.toISOString(),
    meetingType: 'REGULAR' as const,
    agenda: `E2E 1:1 agenda ${Date.now()}`,
  }
}

export function buildRecognition(receiverId: string, value: 'CHALLENGE' | 'TRUST' | 'RESPONSIBILITY' | 'RESPECT' = 'CHALLENGE') {
  return {
    receiverId,
    coreValue: value,
    message: `E2E recognition test message with sufficient length ${Date.now()}`,
    isPublic: true,
  }
}

export function buildSurvey() {
  const ts = Date.now()
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  return {
    title: `E2E Pulse Survey ${ts}`,
    description: `E2E test survey (${ts})`,
    targetScope: 'ALL' as const,
    anonymityLevel: 'FULL_ANONYMOUS' as const,
    minRespondentsForReport: 1,
    openAt: past.toISOString(),
    closeAt: future.toISOString(),
    questions: [
      {
        questionText: 'How satisfied are you with your team collaboration?',
        questionType: 'LIKERT' as const,
        sortOrder: 0,
        isRequired: true,
      },
      {
        questionText: 'Any suggestions for improvement?',
        questionType: 'TEXT' as const,
        sortOrder: 1,
        isRequired: false,
      },
    ],
  }
}

export function futureDateStr(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}
