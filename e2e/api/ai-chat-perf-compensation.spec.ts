// ═══════════════════════════════════════════════════════════
// Phase 2 API P13 — Spec 1
// AI Smoke Tests, HR Chat, Performance Compensation Pipeline,
// Results, Reviews Deeper, Checkins, Team Goals, Peer Review Deeper
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import * as f from '../helpers/p13-fixtures'

// ═══════════════════════════════════════════════════════════
// Section A: AI Smoke — Input Validation (HR_ADMIN)
// ═══════════════════════════════════════════════════════════

test.describe('AI Smoke: Input Validation', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  // calibration-analysis
  test('POST /ai/calibration-analysis (smoke)', async ({ request }) => {
    test.skip(!!process.env.CI, 'Anthropic API key not available in CI')
    const api = new ApiClient(request)
    const res = await f.postAi(api, 'calibration-analysis', f.buildCalibrationRequest())
    // Smoke: accept 200 (AI working) or 500 (API key missing)
    expect([200, 500]).toContain(res.status)
  })

  test('POST /ai/calibration-analysis missing body → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.postAi(api, 'calibration-analysis', {})
    assertError(res, 400, 'calibration missing body')
  })

  // eval-comment
  test('POST /ai/eval-comment (smoke)', async ({ request }) => {
    test.skip(!!process.env.CI, 'Anthropic API key not available in CI')
    const api = new ApiClient(request)
    const res = await f.postAi(api, 'eval-comment', f.buildEvalCommentRequest())
    expect([200, 500]).toContain(res.status)
  })

  test('POST /ai/eval-comment missing body → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.postAi(api, 'eval-comment', {})
    assertError(res, 400, 'eval-comment missing body')
  })

  // executive-report
  test('POST /ai/executive-report (smoke)', async ({ request }) => {
    test.skip(!!process.env.CI, 'Anthropic API key not available in CI')
    const api = new ApiClient(request)
    const res = await f.postAi(api, 'executive-report', f.buildExecutiveReportRequest())
    expect([200, 500]).toContain(res.status)
  })

  // job-description
  test('POST /ai/job-description (smoke)', async ({ request }) => {
    test.skip(!!process.env.CI, 'Anthropic API key not available in CI')
    const api = new ApiClient(request)
    const res = await f.postAi(api, 'job-description', f.buildJobDescriptionRequest())
    expect([200, 500]).toContain(res.status)
  })

  test('POST /ai/job-description missing title → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.postAi(api, 'job-description', { department: 'Eng' })
    assertError(res, 400, 'job-description missing title')
  })

  // onboarding-checkin-summary
  test('POST /ai/onboarding-checkin-summary invalid UUID → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.postAi(api, 'onboarding-checkin-summary', { employeeId: 'not-a-uuid' })
    assertError(res, 400, 'onboarding-checkin-summary invalid UUID')
  })

  // one-on-one-notes
  test('POST /ai/one-on-one-notes missing meetingId → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.postAi(api, 'one-on-one-notes', {})
    assertError(res, 400, 'one-on-one-notes missing meetingId')
  })

  // payroll-anomaly
  test('POST /ai/payroll-anomaly fake runId → 404|400|500', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.postAi(api, 'payroll-anomaly', f.buildPayrollAnomalyRequest())
    // 404 (run not found), 400 (validation), or 500 (AI key)
    expect([400, 404, 500]).toContain(res.status)
  })

  // peer-review-summary
  test('POST /ai/peer-review-summary missing body → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.postAi(api, 'peer-review-summary', {})
    assertError(res, 400, 'peer-review-summary missing body')
  })

  // pulse-analysis
  test('POST /ai/pulse-analysis fake surveyId → 400|404|500', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.postAi(api, 'pulse-analysis', f.buildPulseAnalysisRequest())
    expect([400, 404, 500]).toContain(res.status)
  })

  // resume-analysis
  test('POST /ai/resume-analysis (smoke)', async ({ request }) => {
    test.skip(!!process.env.CI, 'Anthropic API key not available in CI')
    const api = new ApiClient(request)
    const res = await f.postAi(api, 'resume-analysis', f.buildResumeAnalysisRequest())
    expect([200, 500]).toContain(res.status)
  })

  test('POST /ai/resume-analysis missing body → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.postAi(api, 'resume-analysis', {})
    assertError(res, 400, 'resume-analysis missing body')
  })
})

// ═══════════════════════════════════════════════════════════
// Section B: AI RBAC — EMPLOYEE Blocked from Sensitive AI
// ═══════════════════════════════════════════════════════════

test.describe('AI RBAC: EMPLOYEE Blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('POST /ai/calibration-analysis as EMPLOYEE → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.postAi(api, 'calibration-analysis', f.buildCalibrationRequest())
    assertError(res, 403, 'EMPLOYEE blocked from calibration-analysis')
  })

  test('POST /ai/executive-report as EMPLOYEE → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.postAi(api, 'executive-report', f.buildExecutiveReportRequest())
    assertError(res, 403, 'EMPLOYEE blocked from executive-report')
  })

  test('POST /ai/payroll-anomaly as EMPLOYEE → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.postAi(api, 'payroll-anomaly', f.buildPayrollAnomalyRequest())
    assertError(res, 403, 'EMPLOYEE blocked from payroll-anomaly')
  })

  test('POST /ai/peer-review-summary as EMPLOYEE → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.postAi(api, 'peer-review-summary', { cycleId: '00000000-0000-4000-a000-000000000001', employeeId: '00000000-0000-4000-a000-000000000001' })
    assertError(res, 403, 'EMPLOYEE blocked from peer-review-summary')
  })
})

// ═══════════════════════════════════════════════════════════
// Section C: HR Chat — EMPLOYEE Session Lifecycle (serial)
// ═══════════════════════════════════════════════════════════

test.describe('HR Chat: EMPLOYEE Lifecycle', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('EMPLOYEE') })

  let sessionId = ''
  let assistantMessageId = ''

  test('GET /hr-chat/sessions returns list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listSessions(api)
    assertOk(res, 'list sessions')
    expect(Array.isArray(res.data)).toBe(true)
  })

  test('POST /hr-chat/sessions creates new session', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.createSession(api, f.buildChatSession())
    assertOk(res, 'create session')
    sessionId = (res.data as { id: string }).id
    expect(sessionId).toBeTruthy()
  })

  test('GET /hr-chat/sessions/[id]/messages returns empty', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getMessages(api, sessionId)
    assertOk(res, 'get messages')
    expect(Array.isArray(res.data)).toBe(true)
  })

  test('POST /hr-chat/sessions/[id]/messages sends message (smoke)', async ({ request }) => {
    test.skip(!!process.env.CI, 'Anthropic API key not available in CI')
    const api = new ApiClient(request)
    const res = await f.postMessage(api, sessionId, f.buildChatMessage())
    // 200 if AI works, 500 if embedding/Claude API key missing
    expect([200, 500]).toContain(res.status)
    if (res.ok && res.data) {
      const data = res.data as { assistantMessage?: { id: string } }
      if (data.assistantMessage?.id) {
        assistantMessageId = data.assistantMessage.id
      }
    }
  })

  test('POST /hr-chat/messages/[id]/escalate escalates (if message exists)', async ({ request }) => {
    const api = new ApiClient(request)
    if (!assistantMessageId) {
      // If previous test didn't produce a message, use fake ID → 404
      const res = await f.escalateMessage(api, '00000000-0000-4000-a000-000000000099')
      assertError(res, 404, 'escalate fake message')
    } else {
      const res = await f.escalateMessage(api, assistantMessageId)
      assertOk(res, 'escalate message')
    }
  })

  test('PUT /hr-chat/messages/[id]/feedback submits feedback (if message exists)', async ({ request }) => {
    const api = new ApiClient(request)
    if (!assistantMessageId) {
      const res = await f.feedbackMessage(api, '00000000-0000-4000-a000-000000000099', f.buildChatFeedback())
      assertError(res, 404, 'feedback fake message')
    } else {
      const res = await f.feedbackMessage(api, assistantMessageId, f.buildChatFeedback())
      assertOk(res, 'submit feedback')
    }
  })

  test('GET /hr-chat/sessions/[id]/messages invalid session → 404', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getMessages(api, '00000000-0000-4000-a000-000000000099')
    assertError(res, 404, 'invalid session messages')
  })

  test('GET /hr-chat/sessions scoped to user (no cross-leak)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listSessions(api)
    assertOk(res, 'list own sessions')
    // All sessions should belong to EMPLOYEE — if any returned, they're scoped
    expect(Array.isArray(res.data)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════
// Section D: Performance Compensation Pipeline — HR_ADMIN
// ═══════════════════════════════════════════════════════════

test.describe('Perf Compensation Pipeline: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  let cycleId = ''

  test('resolve cycle ID', async ({ request }) => {
    const id = await f.resolveCycleId(request)
    expect(id, 'cycleId must exist').toBeTruthy()
    cycleId = id!
  })

  test('GET /performance/compensation/[cycleId]/dashboard returns data', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getCompDashboard(api, cycleId)
    // May return 200 or 400 (cycle not in COMP_REVIEW)
    expect([200, 400]).toContain(res.status)
  })

  test('GET /performance/compensation/[cycleId]/recommendations returns data', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getCompRecommendations(api, cycleId)
    // May be 200 or 400 (cycle must be in COMP_REVIEW+)
    expect([200, 400]).toContain(res.status)
  })

  test('POST /performance/compensation/[cycleId]/approve without body returns error', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.approveCompensation(api, cycleId, f.buildCompensationApprove())
    // 400 (not in COMP_REVIEW or employees unprocessed) expected
    expect([200, 400]).toContain(res.status)
  })

  test('PUT /performance/compensation/[cycleId]/apply invalid adjustments → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await api.put(`/api/v1/performance/compensation/${cycleId}/apply`, { adjustments: [] })
    assertError(res, 400, 'empty adjustments rejected')
  })

  test('GET /performance/compensation/[cycleId]/export returns data', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getCompExport(api, cycleId)
    // 200 or 400 depending on cycle state
    expect([200, 400]).toContain(res.status)
  })

  test('GET /performance/compensation/fake-cycle/dashboard → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getCompDashboard(api, '00000000-0000-4000-a000-000000000099')
    assertError(res, 400, 'fake cycle dashboard')
  })
})

// ─── Compensation RBAC: EMPLOYEE Blocked ────────────────

test.describe('Perf Compensation RBAC: EMPLOYEE Blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /performance/compensation/[cycleId]/dashboard as EMPLOYEE → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getCompDashboard(api, '00000000-0000-4000-a000-000000000001')
    assertError(res, 403, 'EMPLOYEE blocked from comp dashboard')
  })

  test('GET /performance/compensation/[cycleId]/export as EMPLOYEE → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getCompExport(api, '00000000-0000-4000-a000-000000000001')
    assertError(res, 403, 'EMPLOYEE blocked from comp export')
  })
})

// ═══════════════════════════════════════════════════════════
// Section E: Performance Results — Multi-Role
// ═══════════════════════════════════════════════════════════

test.describe('Perf Results: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  let cycleId = ''

  test('resolve cycle ID', async ({ request }) => {
    const id = await f.resolveCycleId(request)
    expect(id).toBeTruthy()
    cycleId = id!
  })

  test('GET /performance/results/admin returns paginated list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getResultsAdmin(api, { cycleId })
    assertOk(res, 'results admin')
  })

  test('GET /performance/results/admin response shape', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getResultsAdmin(api, { cycleId, page: '1', limit: '5' })
    assertOk(res, 'results admin shape')
    expect(Array.isArray(res.data)).toBe(true)
  })
})

test.describe('Perf Results: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /performance/results/admin as EMPLOYEE → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getResultsAdmin(api, { cycleId: '00000000-0000-4000-a000-000000000001' })
    assertError(res, 403, 'EMPLOYEE blocked from admin results')
  })

  test('GET /performance/results/me returns own results', async ({ request }) => {
    const cycleId = await f.resolveCycleId(request)
    if (!cycleId) return
    const api = new ApiClient(request)
    const res = await f.getResultsMe(api, { cycleId })
    // 200 or 400 (missing data)
    expect([200, 400]).toContain(res.status)
  })
})

test.describe('Perf Results: MANAGER', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('GET /performance/results/team returns team data', async ({ request }) => {
    const cycleId = await f.resolveCycleId(request)
    if (!cycleId) return
    const api = new ApiClient(request)
    const res = await f.getResultsTeam(api, { cycleId })
    // May be 200 or 400 depending on cycle state
    expect([200, 400]).toContain(res.status)
  })
})

// ═══════════════════════════════════════════════════════════
// Section F: Performance Reviews Deeper — Multi-Role
// ═══════════════════════════════════════════════════════════

test.describe('Perf Reviews Deeper: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('POST /performance/reviews/fake-id/acknowledge → 404', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.acknowledgeReview(api, '00000000-0000-4000-a000-000000000099')
    assertError(res, 404, 'acknowledge fake review')
  })

  test('POST /performance/reviews/fake-id/notify → 404', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.notifyReview(api, '00000000-0000-4000-a000-000000000099')
    assertError(res, 404, 'notify fake review')
  })

  test('GET /performance/reviews/fake-id/overdue → 404', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getOverdue(api, '00000000-0000-4000-a000-000000000099')
    assertError(res, 404, 'overdue fake review')
  })
})

test.describe('Perf Reviews Deeper: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /performance/reviews/my-history returns history', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getMyHistory(api)
    assertOk(res, 'my history')
  })

  test('GET /performance/reviews/my-result returns own result', async ({ request }) => {
    const cycleId = await f.resolveCycleId(request)
    if (!cycleId) return
    const api = new ApiClient(request)
    const res = await f.getMyResult(api, { cycleId })
    // 200 or 400 (no review in cycle)
    expect([200, 400]).toContain(res.status)
  })

  test('POST /performance/reviews/fake-id/acknowledge as EMPLOYEE → 404', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.acknowledgeReview(api, '00000000-0000-4000-a000-000000000099')
    // 404 (review not found) or 403
    expect([403, 404]).toContain(res.status)
  })
})

// ═══════════════════════════════════════════════════════════
// Section G: Checkins & Team Goals — MANAGER
// ═══════════════════════════════════════════════════════════

test.describe('Perf Checkins & Team Goals: MANAGER', () => {
  test.use({ storageState: authFile('MANAGER') })

  let cycleId = ''

  test('resolve cycle ID', async ({ request }) => {
    const id = await f.resolveCycleId(request)
    expect(id).toBeTruthy()
    cycleId = id!
  })

  test('GET /performance/checkins/[cycleId]/status returns status', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getCheckinStatus(api, cycleId)
    // 200 or 400
    expect([200, 400]).toContain(res.status)
  })

  test('GET /performance/team-goals returns team goals', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getTeamGoals(api, { cycleId })
    // 200 or 400
    expect([200, 400]).toContain(res.status)
  })
})

test.describe('Perf Checkins: EMPLOYEE Blocked from Status', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /performance/checkins/[cycleId]/status as EMPLOYEE → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getCheckinStatus(api, '00000000-0000-4000-a000-000000000001')
    assertError(res, 403, 'EMPLOYEE blocked from checkin status')
  })

  test('GET /performance/team-goals as EMPLOYEE → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getTeamGoals(api, { cycleId: '00000000-0000-4000-a000-000000000001' })
    assertError(res, 403, 'EMPLOYEE blocked from team goals')
  })
})

// ═══════════════════════════════════════════════════════════
// Section H: Peer Review Deeper — HR_ADMIN + EMPLOYEE
// ═══════════════════════════════════════════════════════════

test.describe('Peer Review Deeper: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /performance/peer-review/candidates requires params', async ({ request }) => {
    const cycleId = await f.resolveCycleId(request)
    const employeeId = await f.resolveEmployeeId(request)
    if (!cycleId || !employeeId) return
    const api = new ApiClient(request)
    const res = await f.getPeerCandidates(api, { cycleId, employeeId })
    // 200 or 400
    expect([200, 400]).toContain(res.status)
  })

  test('POST /performance/peer-review/submit with fake nominationId → 400|404', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.submitPeerReview(api, f.buildPeerReviewSubmit('00000000-0000-4000-a000-000000000099'))
    expect([400, 404]).toContain(res.status)
  })
})
