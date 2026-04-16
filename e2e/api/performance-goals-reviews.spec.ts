// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Performance Goals & Reviews API Tests
//
// P5: Goals workflow, peer review pipeline, results/reviews,
// checkins, calibration extras.
// Reuses eval-fixtures for cycle management.
// ═══════════════════════════════════════════════════════════

import { test, expect, type APIRequestContext } from '@playwright/test'
import { authFile } from '../helpers/auth'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { resolveSeedData, resolveEmployeeId } from '../helpers/test-data'
import { createTestCycle, initializeCycle, advanceTo, cleanupTestCycle } from '../helpers/eval-fixtures'
import * as pf from '../helpers/performance-fixtures'

// ═══════════════════════════════════════════════════════════
// BLOCK 1: Goals Workflow (serial, 14 tests)
// ═══════════════════════════════════════════════════════════

test.describe('Goals Workflow', () => {
  test.describe.configure({ mode: 'serial' })

  let hrRequest: APIRequestContext
  let empRequest: APIRequestContext
  let mgrRequest: APIRequestContext
  let hrClient: ApiClient
  let empClient: ApiClient
  let mgrClient: ApiClient

  let cycleId: string
  let goalId1: string
  let goalId2: string

  test.beforeAll(async ({ playwright }) => {
    hrRequest = await playwright.request.newContext({ storageState: authFile('HR_ADMIN') })
    empRequest = await playwright.request.newContext({ storageState: authFile('EMPLOYEE') })
    mgrRequest = await playwright.request.newContext({ storageState: authFile('MANAGER') })
    hrClient = new ApiClient(hrRequest)
    empClient = new ApiClient(empRequest)
    mgrClient = new ApiClient(mgrRequest)

    // Create cycle and advance to ACTIVE so employees can set goals
    cycleId = await createTestCycle(hrRequest, {
      name: `E2E Goals Workflow ${Date.now()}`,
      half: 'H1',
    })
    await initializeCycle(hrRequest, cycleId)
  })

  test.afterAll(async () => {
    if (cycleId) {
      await cleanupTestCycle(hrRequest, cycleId).catch(() => {})
    }
    await hrRequest?.dispose()
    await empRequest?.dispose()
    await mgrRequest?.dispose()
  })

  test('1. EMPLOYEE creates goal 1 (weight=60)', async () => {
    const payload = pf.buildGoal(cycleId, 1)
    const result = await pf.createGoal(empClient, payload)
    assertOk(result, 'create goal 1')

    const data = result.data as Record<string, unknown>
    expect(data.id).toBeTruthy()
    goalId1 = data.id as string
  })

  test('2. EMPLOYEE creates goal 2 (weight=40)', async () => {
    const payload = pf.buildGoal(cycleId, 2)
    const result = await pf.createGoal(empClient, payload)
    assertOk(result, 'create goal 2')

    const data = result.data as Record<string, unknown>
    expect(data.id).toBeTruthy()
    goalId2 = data.id as string
  })

  test('3. EMPLOYEE lists goals for cycle', async () => {
    const result = await pf.listGoals(empClient, cycleId)
    assertOk(result, 'list goals')

    const data = result.data
    expect(Array.isArray(data)).toBe(true)
    expect((data as unknown[]).length).toBeGreaterThanOrEqual(2)
  })

  test('4. EMPLOYEE gets goal detail', async () => {
    const result = await pf.getGoal(empClient, goalId1)
    assertOk(result, 'get goal detail')

    const data = result.data as Record<string, unknown>
    expect(data.id).toBe(goalId1)
    expect(data.title).toBeTruthy()
    expect(data.weight).toBe(60)
  })

  test('5. EMPLOYEE updates DRAFT goal title', async () => {
    const result = await pf.updateGoal(empClient, goalId1, {
      title: `Updated Goal Title ${Date.now()}`,
    })
    assertOk(result, 'update DRAFT goal title')
  })

  test('6. EMPLOYEE submits goals (total weight=100)', async () => {
    const result = await pf.submitGoal(empClient, goalId1)
    assertOk(result, 'submit goals')
  })

  test('7. EMPLOYEE cannot update PENDING_APPROVAL goal', async () => {
    const result = await pf.updateGoal(empClient, goalId1, {
      title: 'Should fail — goal is PENDING_APPROVAL',
    })
    assertError(result, 400, 'update PENDING_APPROVAL goal blocked')
  })

  test('8. HR_ADMIN approves goal 1', async () => {
    const result = await pf.approveGoal(hrClient, goalId1)
    assertOk(result, 'approve goal 1')
  })

  test('9. HR_ADMIN approves goal 2', async () => {
    const result = await pf.approveGoal(hrClient, goalId2)
    assertOk(result, 'approve goal 2')
  })

  test('10. HR_ADMIN requests revision on goal 1', async () => {
    const result = await pf.requestRevision(hrClient, goalId1, {
      reason: 'E2E test: please revise the goal scope',
    })
    assertOk(result, 'request revision on goal 1')
  })

  test('11. EMPLOYEE adds progress (60%) on approved goal 2', async () => {
    const result = await pf.addProgress(empClient, goalId2, {
      progressPct: 60,
      note: 'E2E progress update — 60% completed',
    })
    assertOk(result, 'add progress on goal 2')
  })

  test('12. EMPLOYEE lists progress entries', async () => {
    const result = await pf.listProgress(empClient, goalId2)
    assertOk(result, 'list progress entries')

    const data = result.data
    expect(Array.isArray(data)).toBe(true)
    expect((data as unknown[]).length).toBeGreaterThanOrEqual(1)
  })

  test('13. HR_ADMIN bulk-locks goals', async () => {
    const result = await pf.bulkLockGoals(hrClient, { cycleId })
    assertOk(result, 'bulk-lock goals')
  })

  test('14. MANAGER views team goals', async () => {
    const result = await pf.getTeamGoals(mgrClient, cycleId)
    assertOk(result, 'manager team goals')

    const data = result.data
    expect(Array.isArray(data)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════
// BLOCK 2: Goals RBAC (parallel, 4 tests)
// ═══════════════════════════════════════════════════════════

test.describe('Goals RBAC: EMPLOYEE boundaries', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  const FAKE_CYCLE_ID = '00000000-0000-0000-0000-000000000000'
  const FAKE_GOAL_ID = '00000000-0000-0000-0000-000000000001'

  test('EMPLOYEE cannot bulk-lock goals', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.bulkLockGoals(client, { cycleId: FAKE_CYCLE_ID })
    assertError(result, 403, 'employee bulk-lock blocked')
  })

  test('EMPLOYEE cannot unlock goals', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.unlockGoal(client, FAKE_GOAL_ID)
    assertError(result, 403, 'employee unlock blocked')
  })

  test('EMPLOYEE cannot request revision', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.requestRevision(client, FAKE_GOAL_ID, {
      reason: 'Should be blocked',
    })
    // 403 (permission denied) or 400 (not found / wrong state)
    expect(result.status).toBeGreaterThanOrEqual(400)
    expect(result.ok).toBe(false)
  })

  test('EMPLOYEE cannot view team-goals', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getTeamGoals(client, FAKE_CYCLE_ID)
    assertError(result, 403, 'employee team-goals blocked')
  })
})

// ═══════════════════════════════════════════════════════════
// BLOCK 3: Peer Review Pipeline (serial, 10 tests)
// ═══════════════════════════════════════════════════════════

test.describe('Peer Review Pipeline', () => {
  test.describe.configure({ mode: 'serial' })

  let hrRequest: APIRequestContext
  let empRequest: APIRequestContext
  let hrClient: ApiClient
  let empClient: ApiClient

  let cycleId: string
  let employeeAId: string
  let nomineeIds: string[] = []
  let nominationId: string | undefined

  test.beforeAll(async ({ playwright }) => {
    hrRequest = await playwright.request.newContext({ storageState: authFile('HR_ADMIN') })
    empRequest = await playwright.request.newContext({ storageState: authFile('EMPLOYEE') })
    hrClient = new ApiClient(hrRequest)
    empClient = new ApiClient(empRequest)

    // Resolve seed employee IDs for nomination
    employeeAId = (await resolveSeedData(hrRequest)).employeeId

    // Resolve 3 employees as potential peer reviewers
    const empB = await resolveEmployeeId(hrRequest, '정다은')
    const empC = await resolveEmployeeId(hrRequest, '송현우')
    const mgr = await resolveEmployeeId(hrRequest, '박준혁')
    nomineeIds = [empB, empC, mgr]
  })

  test.afterAll(async () => {
    if (cycleId) {
      await cleanupTestCycle(hrRequest, cycleId).catch(() => {})
    }
    await hrRequest?.dispose()
    await empRequest?.dispose()
  })

  test('1. HR creates cycle and advances to EVAL_OPEN', async () => {
    cycleId = await createTestCycle(hrRequest, {
      name: `E2E Peer Review ${Date.now()}`,
      half: 'H1',
    })
    await advanceTo(hrRequest, cycleId, 'EVAL_OPEN')
    expect(cycleId).toBeTruthy()
  })

  test('2. HR gets peer review candidates', async () => {
    const result = await pf.getCandidates(hrClient, cycleId)
    assertOk(result, 'get peer review candidates')
  })

  test('3. HR nominates 3 reviewers for EMPLOYEE_A', async () => {
    test.skip(nomineeIds.length < 3, 'insufficient nominee IDs resolved')

    const result = await pf.nominate(hrClient, {
      cycleId,
      employeeId: employeeAId,
      nomineeIds,
    })
    assertOk(result, 'nominate 3 reviewers')
  })

  test('4. Duplicate nomination is idempotent or rejected', async () => {
    test.skip(nomineeIds.length < 3, 'insufficient nominee IDs resolved')

    const result = await pf.nominate(hrClient, {
      cycleId,
      employeeId: employeeAId,
      nomineeIds,
    })
    // Idempotent (200) or conflict (400) — both acceptable
    expect(result.status).toBeLessThan(500)
  })

  test('5. EMPLOYEE checks my-assignments', async () => {
    const result = await pf.getMyAssignments(empClient)
    assertOk(result, 'get my peer review assignments')

    const data = result.data
    expect(Array.isArray(data)).toBe(true)

    // If assignments exist, capture first nomination ID for later tests
    const assignments = data as Array<{ id: string; status?: string }>
    if (assignments.length > 0) {
      nominationId = assignments[0].id
    }
  })

  test('6. EMPLOYEE submits peer review with 4 scores', async () => {
    test.skip(!nominationId, 'no nomination assignment found')

    const result = await pf.submitPeerReview(empClient, {
      nominationId: nominationId!,
      scoreChallenge: 4,
      scoreTrust: 5,
      scoreResponsibility: 4,
      scoreRespect: 5,
      overallComment: 'E2E peer review — excellent collaboration across the team',
    })
    assertOk(result, 'submit peer review')
  })

  test('7. Double-submit same nomination rejected', async () => {
    test.skip(!nominationId, 'no nomination assignment found')

    const result = await pf.submitPeerReview(empClient, {
      nominationId: nominationId!,
      scoreChallenge: 3,
      scoreTrust: 3,
      scoreResponsibility: 3,
      scoreRespect: 3,
      overallComment: 'E2E duplicate submit attempt',
    })
    assertError(result, 400, 'double submit peer review')
  })

  test('8. HR views peer review results for employee', async () => {
    const result = await pf.getPeerResults(hrClient, employeeAId)
    assertOk(result, 'get peer review results')
  })

  test('9. HR skips a nomination', async () => {
    // Find a nomination that can be skipped (PENDING status)
    const assignResult = await pf.getMyAssignments(empClient)
    const assignments = (assignResult.data ?? []) as Array<{ id: string; status?: string }>
    const pendingNom = assignments.find((a) => a.status === 'PENDING')

    if (pendingNom) {
      const result = await pf.skipNomination(hrClient, pendingNom.id)
      assertOk(result, 'skip nomination')
    } else {
      // No pending nomination available — skip test gracefully
      test.skip(true, 'no pending nomination available to skip')
    }
  })

  test('10. Cleanup: delete peer review cycle', async () => {
    if (cycleId) {
      await cleanupTestCycle(hrRequest, cycleId).catch(() => {})
    }
  })
})

// ═══════════════════════════════════════════════════════════
// BLOCK 4: Results & Reviews (parallel, 8 tests)
// ═══════════════════════════════════════════════════════════

test.describe('Results & Reviews: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('HR gets admin results', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getAdminResults(client)
    assertOk(result, 'admin results')

    const data = result.data
    expect(Array.isArray(data)).toBe(true)
  })

  test('Admin results have expected shape', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getAdminResults(client)
    assertOk(result, 'admin results shape check')

    const data = result.data as Array<Record<string, unknown>>
    if (data.length > 0) {
      const first = data[0]
      // Admin results should include employee info and evaluation data
      expect(first).toHaveProperty('employeeId')
    }
  })
})

test.describe('Results & Reviews: MANAGER', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('MANAGER gets team results', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getTeamResults(client)
    assertOk(result, 'team results')

    const data = result.data
    expect(Array.isArray(data)).toBe(true)
  })
})

test.describe('Results & Reviews: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('EMPLOYEE gets my results', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getMyResults(client)
    assertOk(result, 'my results')
  })

  test('EMPLOYEE gets my-result', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getMyReviewResult(client)
    // May return 200 with data or 404 if no review exists yet
    if (result.status === 404) {
      expect(result.ok).toBe(false)
    } else {
      assertOk(result, 'my review result')
    }
  })

  test('EMPLOYEE gets my-history', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getMyHistory(client)
    assertOk(result, 'my review history')
  })

  test('EMPLOYEE gets overdue reviews', async ({ request }) => {
    const client = new ApiClient(request)
    // getOverdueReviews requires a reviewId — use a fake one to test the endpoint
    const FAKE_REVIEW_ID = '00000000-0000-0000-0000-000000000000'
    const result = await pf.getOverdueReviews(client, FAKE_REVIEW_ID)
    // 200 (empty) or 404 — both acceptable for non-existent review
    expect(result.status).toBeLessThan(500)
  })

  test('EMPLOYEE blocked from admin results', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getAdminResults(client)
    assertError(result, 403, 'employee admin results blocked')
  })
})

// ═══════════════════════════════════════════════════════════
// BLOCK 5: Checkins & Calibration Extras (9 tests)
// ═══════════════════════════════════════════════════════════

test.describe('Checkins', () => {
  test.describe.configure({ mode: 'serial' })

  let hrRequest: APIRequestContext
  let empRequest: APIRequestContext
  let hrClient: ApiClient
  let empClient: ApiClient
  let cycleId: string

  test.beforeAll(async ({ playwright }) => {
    hrRequest = await playwright.request.newContext({ storageState: authFile('HR_ADMIN') })
    empRequest = await playwright.request.newContext({ storageState: authFile('EMPLOYEE') })
    hrClient = new ApiClient(hrRequest)
    empClient = new ApiClient(empRequest)

    // Create cycle and advance to ACTIVE for checkins
    cycleId = await createTestCycle(hrRequest, {
      name: `E2E Checkin ${Date.now()}`,
      half: 'H1',
    })
    await initializeCycle(hrRequest, cycleId)
  })

  test.afterAll(async () => {
    if (cycleId) {
      await cleanupTestCycle(hrRequest, cycleId).catch(() => {})
    }
    await hrRequest?.dispose()
    await empRequest?.dispose()
  })

  test('1. EMPLOYEE creates checkin', async () => {
    const result = await pf.createCheckin(empClient, {
      cycleId,
      content: 'E2E checkin — mid-cycle progress update',
      type: 'EMPLOYEE',
    })
    assertOk(result, 'create employee checkin')
  })

  test('2. Get checkin status for cycle', async () => {
    const result = await pf.getCheckinStatus(empClient, cycleId)
    assertOk(result, 'get checkin status')
  })

  test('3. HR creates manager-type checkin', async () => {
    const seed = await resolveSeedData(hrRequest)
    const result = await pf.createCheckin(hrClient, {
      cycleId,
      content: 'E2E manager checkin — team review notes',
      type: 'MANAGER',
      employeeId: seed.employeeId,
    })
    assertOk(result, 'create manager checkin')
  })

  test('4. Cleanup: delete checkin cycle', async () => {
    if (cycleId) {
      await cleanupTestCycle(hrRequest, cycleId).catch(() => {})
    }
  })
})

test.describe('Calibration Extras: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('HR lists calibration sessions', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.listCalibrationSessions(client)
    assertOk(result, 'list calibration sessions')

    const data = result.data
    expect(Array.isArray(data)).toBe(true)
  })

  test('HR gets calibration rules', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getCalibrationRules(client)
    assertOk(result, 'get calibration rules')
  })

  test('HR gets distribution for seed session', async ({ request }) => {
    const client = new ApiClient(request)
    // First, find a calibration session
    const sessionsResult = await pf.listCalibrationSessions(client)
    assertOk(sessionsResult, 'list sessions for distribution')

    const sessions = sessionsResult.data as Array<{ id: string }>
    if (sessions.length === 0) {
      return test.skip(true, 'no calibration sessions found')
    }

    const result = await pf.getDistribution(client, sessions[0].id)
    // 200 (with data) or 404 (if session has no distribution yet)
    if (result.status === 404) {
      expect(result.ok).toBe(false)
    } else {
      assertOk(result, 'get distribution')
    }
  })
})

test.describe('Calibration Extras: EMPLOYEE boundaries', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('EMPLOYEE blocked from calibration sessions', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.listCalibrationSessions(client)
    assertError(result, 403, 'employee calibration sessions blocked')
  })

  test('EMPLOYEE blocked from calibration rules', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getCalibrationRules(client)
    assertError(result, 403, 'employee calibration rules blocked')
  })
})
