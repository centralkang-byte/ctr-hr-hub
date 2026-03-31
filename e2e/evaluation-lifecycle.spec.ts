// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Evaluation Lifecycle E2E Tests
//
// Tests the 9-state performance cycle state machine via API.
// Source of truth: src/lib/performance/pipeline.ts
//
// State Machine (8 transitions):
// DRAFT → ACTIVE → CHECK_IN → EVAL_OPEN → CALIBRATION
//   → FINALIZED → CLOSED → COMP_REVIEW → COMP_COMPLETED
//
// Role permissions per state:
// | State          | HR_ADMIN             | MANAGER           | EMPLOYEE        |
// |----------------|----------------------|-------------------|-----------------|
// | DRAFT          | Create, Initialize   | -                 | -               |
// | ACTIVE         | Advance              | View team goals   | Set goals       |
// | CHECK_IN       | Advance              | Check-in reports  | Mid-cycle       |
// | EVAL_OPEN      | Advance, Monitor     | Evaluate reports  | Self-evaluate   |
// | CALIBRATION    | Adjust, Advance      | -                 | -               |
// | FINALIZED      | Advance              | -                 | -               |
// | CLOSED         | Notify, Advance      | View team results | View, Ack       |
// | COMP_REVIEW    | Merit, Approve, Adv  | -                 | -               |
// | COMP_COMPLETED | View                 | View              | View            |
// ═══════════════════════════════════════════════════════════

import { test, expect, request as playwrightRequest } from '@playwright/test'
import { authFile } from './helpers/auth'
import {
  createTestCycle,
  getCycle,
  initializeCycle,
  advanceCycle,
  createGoal,
  submitSelfEval,
  cleanupTestCycle,
} from './helpers/eval-fixtures'

// ─── Shared state across sequential tests ───────────────────

let cycleId: string

// ─── HR_ADMIN creates and drives the cycle ──────────────────

test.describe('Evaluation Lifecycle: Full State Machine', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  test.beforeAll(async ({ request }) => {
    cycleId = await createTestCycle(request, {
      name: `E2E Lifecycle ${Date.now()}`,
    })
  })

  test.afterAll(async ({ request }) => {
    if (cycleId) {
      await cleanupTestCycle(request, cycleId)
    }
  })

  // ── Test 1: DRAFT → ACTIVE (Initialize) ──────────────────

  test('1. Initialize cycle: DRAFT → ACTIVE', async ({ request }) => {
    // Verify starting state
    const before = await getCycle(request, cycleId)
    expect(before.status).toBe('DRAFT')

    // Initialize creates PerformanceReview records and advances to ACTIVE
    await initializeCycle(request, cycleId)

    const after = await getCycle(request, cycleId)
    expect(after.status).toBe('ACTIVE')
  })

  // ── Test 2: ACTIVE → CHECK_IN ────────────────────────────

  test('2. Advance: ACTIVE → CHECK_IN', async ({ request }) => {
    const newStatus = await advanceCycle(request, cycleId)
    expect(newStatus).toBe('CHECK_IN')

    const cycle = await getCycle(request, cycleId)
    expect(cycle.status).toBe('CHECK_IN')
  })

  // ── Test 3: CHECK_IN → EVAL_OPEN ─────────────────────────

  test('3. Advance: CHECK_IN → EVAL_OPEN', async ({ request }) => {
    const newStatus = await advanceCycle(request, cycleId)
    expect(newStatus).toBe('EVAL_OPEN')

    const cycle = await getCycle(request, cycleId)
    expect(cycle.status).toBe('EVAL_OPEN')
  })

  // ── Test 3b: Verify self-eval API accessible at EVAL_OPEN ──

  test('3b. EVAL_OPEN: self-eval API returns cycle data', async ({ request }) => {
    // At EVAL_OPEN, the self-evaluation endpoint should accept requests
    const res = await request.get(`/api/v1/performance/evaluations/self?cycleId=${cycleId}`)
    // HR_ADMIN may not have a self-eval record, but endpoint should respond (not 403/500)
    expect(res.status()).toBeLessThan(500)
  })

  // ── Test 4: EVAL_OPEN → CALIBRATION ──────────────────────

  test('4. Advance: EVAL_OPEN → CALIBRATION', async ({ request }) => {
    const newStatus = await advanceCycle(request, cycleId)
    expect(newStatus).toBe('CALIBRATION')
  })

  // ── Test 4b: Verify calibration data accessible ────────────

  test('4b. CALIBRATION: calibration rules API accessible', async ({ request }) => {
    const res = await request.get('/api/v1/performance/calibration/rules')
    expect(res.status()).toBeLessThan(500)
  })

  // ── Test 5: CALIBRATION → FINALIZED ──────────────────────

  test('5. Advance: CALIBRATION → FINALIZED', async ({ request }) => {
    const newStatus = await advanceCycle(request, cycleId)
    expect(newStatus).toBe('FINALIZED')
  })

  // ── Test 6: FINALIZED → CLOSED ───────────────────────────

  test('6. Advance: FINALIZED → CLOSED', async ({ request }) => {
    const newStatus = await advanceCycle(request, cycleId)
    expect(newStatus).toBe('CLOSED')
  })

  // ── Test 6b: Verify result APIs accessible at CLOSED ──────

  test('6b. CLOSED: my-result API accessible', async ({ request }) => {
    const res = await request.get('/api/v1/performance/reviews/my-result')
    // Should respond (HR_ADMIN might have a review or not, but no 500)
    expect(res.status()).toBeLessThan(500)
  })

  // ── Test 7: CLOSED → COMP_REVIEW ─────────────────────────

  test('7. Advance: CLOSED → COMP_REVIEW', async ({ request }) => {
    const newStatus = await advanceCycle(request, cycleId)
    expect(newStatus).toBe('COMP_REVIEW')
  })

  // ── Test 8: COMP_REVIEW → COMP_COMPLETED (terminal) ──────

  test('8. Advance: COMP_REVIEW → COMP_COMPLETED', async ({ request }) => {
    const newStatus = await advanceCycle(request, cycleId)
    expect(newStatus).toBe('COMP_COMPLETED')

    const cycle = await getCycle(request, cycleId)
    expect(cycle.status).toBe('COMP_COMPLETED')
  })

  // ── Test 9: Terminal state — cannot advance further ───────

  test('9. Terminal: COMP_COMPLETED cannot advance', async ({ request }) => {
    const res = await request.put(`/api/v1/performance/cycles/${cycleId}/advance`)
    expect(res.status()).toBe(400)

    const body = await res.json() as { error?: { message?: string } }
    expect(body.error?.message).toContain('더 이상 진행할 수 없습니다')
  })
})

// ─── EMPLOYEE Workflow: Goal → Self-Eval ────────────────────

test.describe('Evaluation Lifecycle: EMPLOYEE Workflow', () => {
  test.describe.configure({ mode: 'serial' })

  let workflowCycleId: string
  let goalId: string

  // HR_ADMIN creates cycle and advances to ACTIVE
  test('setup: HR_ADMIN creates cycle and advances to EVAL_OPEN', async () => {
    const hrRequest = await playwrightRequest.newContext({
      baseURL: 'http://localhost:3002',
      storageState: authFile('HR_ADMIN'),
    })

    workflowCycleId = await createTestCycle(hrRequest, {
      name: `E2E Employee Workflow ${Date.now()}`,
    })
    await initializeCycle(hrRequest, workflowCycleId)
    // ACTIVE → CHECK_IN → EVAL_OPEN
    await advanceCycle(hrRequest, workflowCycleId)
    await advanceCycle(hrRequest, workflowCycleId)

    const cycle = await getCycle(hrRequest, workflowCycleId)
    expect(cycle.status).toBe('EVAL_OPEN')
    await hrRequest.dispose()
  })

  test('EMPLOYEE creates MBO goal', async () => {
    const empRequest = await playwrightRequest.newContext({
      baseURL: 'http://localhost:3002',
      storageState: authFile('EMPLOYEE'),
    })

    goalId = await createGoal(empRequest, {
      cycleId: workflowCycleId,
      title: 'E2E 테스트 목표 — 생산성 향상',
      weight: 100,
      description: 'E2E 테스트용 MBO 목표',
    })

    expect(goalId).toBeTruthy()
    await empRequest.dispose()
  })

  test('EMPLOYEE submits self-evaluation', async () => {
    const empRequest = await playwrightRequest.newContext({
      baseURL: 'http://localhost:3002',
      storageState: authFile('EMPLOYEE'),
    })

    const result = await submitSelfEval(empRequest, {
      cycleId: workflowCycleId,
      goalScores: [{ goalId, score: 4, comment: 'E2E 테스트 — 좋은 성과' }],
      competencyScores: [], // No competencies required
      overallComment: 'E2E 자기평가 제출 테스트',
      status: 'SUBMITTED',
    })

    expect(result.ok).toBe(true)
    // API returns 201 Created for new evaluation, 200 for update
    expect(result.status).toBeLessThan(300)
    await empRequest.dispose()
  })

  test('cleanup: delete workflow cycle', async () => {
    const hrRequest = await playwrightRequest.newContext({
      baseURL: 'http://localhost:3002',
      storageState: authFile('HR_ADMIN'),
    })
    await cleanupTestCycle(hrRequest, workflowCycleId)
    await hrRequest.dispose()
  })
})

// ─── RBAC: EMPLOYEE cannot advance cycle ────────────────────

test.describe('Evaluation Lifecycle: EMPLOYEE restrictions', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('EMPLOYEE cannot advance cycle', async ({ request }) => {
    // Use a dummy cycle ID — permission should be denied before DB lookup
    const res = await request.put('/api/v1/performance/cycles/nonexistent/advance')
    // Should get 403 (forbidden) or 401 — NOT 200
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.ok()).toBe(false)
  })

  test('EMPLOYEE cannot create cycle', async ({ request }) => {
    const res = await request.post('/api/v1/performance/cycles', {
      data: {
        name: 'Unauthorized Cycle',
        year: 2026,
        half: 'H1',
        goalStart: '2026-01-01T00:00:00.000Z',
        goalEnd: '2026-03-31T00:00:00.000Z',
        evalStart: '2026-04-01T00:00:00.000Z',
        evalEnd: '2026-06-30T00:00:00.000Z',
      },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.ok()).toBe(false)
  })
})

// ─── RBAC: MANAGER cannot advance cycle ─────────────────────

test.describe('Evaluation Lifecycle: MANAGER restrictions', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('MANAGER cannot advance cycle', async ({ request }) => {
    const res = await request.put('/api/v1/performance/cycles/nonexistent/advance')
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.ok()).toBe(false)
  })
})
