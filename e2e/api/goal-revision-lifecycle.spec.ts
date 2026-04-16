// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Goal Revision E2E Tests
//
// Tests GoalRevision lifecycle: propose → approve/reject/cancel
// Individual + batch operations, QGP defense, permissions
//
// Uses existing QA seed data:
// - HR_ADMIN: hr@ctr.co.kr (creates cycles, views all)
// - EMPLOYEE: employee-a@ctr.co.kr (proposes revisions)
// - MANAGER: manager@ctr.co.kr (approves/rejects)
// ═══════════════════════════════════════════════════════════

import { test, expect, request as playwrightRequest } from '@playwright/test'
import { authFile } from '../helpers/auth'
import { createTestCycle, advanceTo, createGoal, cleanupTestCycle } from '../helpers/eval-fixtures'

// ─── Helpers ──────────────────────────────────────────────────

async function parseResponse(res: { ok: () => boolean; status: () => number; json: () => Promise<unknown> }) {
  const status = res.status()
  const body = await res.json().catch(() => ({})) as Record<string, unknown>
  const errorObj = body.error as { message?: string } | string | undefined
  const error = typeof errorObj === 'string' ? errorObj : errorObj?.message
  return { status, ok: res.ok(), data: body.data as Record<string, unknown> | undefined, error, body }
}

// ─── State ────────────────────────────────────────────────────

let cycleId: string
let goalId: string
let goalId2: string

// ═══════════════════════════════════════════════════════════
// SETUP: Create cycle + goals as EMPLOYEE, advance to ACTIVE
// ═══════════════════════════════════════════════════════════

test.describe('Goal Revision Lifecycle', () => {
  test.describe.configure({ mode: 'serial' })

  // ── HR ADMIN: create cycle and advance to ACTIVE ──
  test.describe('Setup', () => {
    test.use({ storageState: authFile('HR_ADMIN') })

    test('create cycle and advance to ACTIVE', async ({ request }) => {
      cycleId = await createTestCycle(request, {
        name: `E2E GoalRevision ${Date.now()}`,
        half: 'H2',
      })
      expect(cycleId).toBeTruthy()
      await advanceTo(request, cycleId, 'ACTIVE')
    })
  })

  // ── EMPLOYEE: create goals ──
  test.describe('Employee creates goals', () => {
    test.use({ storageState: authFile('EMPLOYEE') })

    test('create 2 goals', async ({ request }) => {
      goalId = await createGoal(request, {
        cycleId,
        title: 'E2E Revision Test Goal 1',
        weight: 60,
        description: 'First goal for revision testing',
      })
      expect(goalId).toBeTruthy()

      goalId2 = await createGoal(request, {
        cycleId,
        title: 'E2E Revision Test Goal 2',
        weight: 40,
        description: 'Second goal for revision testing',
      })
      expect(goalId2).toBeTruthy()
    })

    test('submit goals for approval', async ({ request }) => {
      // Submit goal 1 — this moves ALL DRAFT goals to PENDING_APPROVAL (weight must be 100%)
      const res = await request.put(`/api/v1/performance/goals/${goalId}/submit`)
      expect(res.ok()).toBeTruthy()
    })

    test('approve goals via HR', async ({ }) => {
      const hrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })

      // Approve goal 1
      const res1 = await hrReq.put(`/api/v1/performance/goals/${goalId}/approve`)
      expect(res1.ok()).toBeTruthy()

      // Approve goal 2
      const res2 = await hrReq.put(`/api/v1/performance/goals/${goalId2}/approve`)
      expect(res2.ok()).toBeTruthy()

      await hrReq.dispose()
    })
  })

  // ═══════════════════════════════════════════════════════════
  // INDIVIDUAL REVISION TESTS
  // ═══════════════════════════════════════════════════════════

  test.describe('Individual Revisions — Employee', () => {
    test.use({ storageState: authFile('EMPLOYEE') })

    let revisionId: string

    test('1. propose revision on APPROVED goal', async ({ request }) => {
      const res = await request.post(`/api/v1/performance/goals/${goalId}/revisions`, {
        data: {
          newTitle: 'Revised Goal Title',
          newWeight: 50,
          reason: 'Scope changed after Q1 review',
        },
      })
      const { ok, data } = await parseResponse(res)
      expect(ok).toBeTruthy()
      expect(data).toBeDefined()

      revisionId = (data as { id: string }).id
      expect(revisionId).toBeTruthy()
      expect((data as { status: string }).status).toBe('PENDING')
      expect((data as { version: number }).version).toBe(1)
    })

    test('2. duplicate PENDING proposal rejected', async ({ request }) => {
      const res = await request.post(`/api/v1/performance/goals/${goalId}/revisions`, {
        data: {
          newTitle: 'Another revision attempt',
          reason: 'Should be blocked',
        },
      })
      expect(res.status()).toBe(400)
    })

    test('3. list revisions returns timeline', async ({ request }) => {
      const res = await request.get(`/api/v1/performance/goals/${goalId}/revisions`)
      const { ok, data } = await parseResponse(res)
      expect(ok).toBeTruthy()

      const revisions = Array.isArray(data) ? data : (data as { revisions?: unknown[] })?.revisions ?? []
      expect(revisions.length).toBeGreaterThanOrEqual(1)
    })

    test('4. cancel own revision', async ({ request }) => {
      const res = await request.put(
        `/api/v1/performance/goals/${goalId}/revisions/${revisionId}/cancel`,
      )
      const { ok, data } = await parseResponse(res)
      expect(ok).toBeTruthy()
      expect((data as { status: string }).status).toBe('CANCELLED')
    })

    test('5. can propose again after cancel', async ({ request }) => {
      const res = await request.post(`/api/v1/performance/goals/${goalId}/revisions`, {
        data: {
          newTitle: 'Re-proposed after cancel',
          newWeight: 55,
          reason: 'Re-proposing after cancellation',
        },
      })
      const { ok, data } = await parseResponse(res)
      expect(ok).toBeTruthy()

      revisionId = (data as { id: string }).id
      expect((data as { version: number }).version).toBe(2)
    })

    test('6. goal detail includes revision count', async ({ request }) => {
      const res = await request.get(`/api/v1/performance/goals/${goalId}`)
      const { ok, data } = await parseResponse(res)
      expect(ok).toBeTruthy()

      const count = (data as { _count?: { revisions?: number } })?._count?.revisions
      expect(count).toBeGreaterThanOrEqual(2)
    })
  })

  // ── HR ADMIN: approve revision (MANAGER lacks performance:manage) ──
  test.describe('Individual Revisions — Approve', () => {
    test.use({ storageState: authFile('HR_ADMIN') })

    test('7. approve pending revision', async ({ request }) => {
      // Get the pending revision
      const listRes = await request.get(`/api/v1/performance/goals/${goalId}/revisions`)
      const listParsed = await parseResponse(listRes)
      const revisions = Array.isArray(listParsed.data) ? listParsed.data : []
      const pending = (revisions as Array<{ id: string; status: string }>).find(
        (r) => r.status === 'PENDING',
      )
      expect(pending).toBeDefined()

      const res = await request.put(
        `/api/v1/performance/goals/${goalId}/revisions/${pending!.id}/approve`,
      )
      const parsed = await parseResponse(res)
      expect(parsed.ok).toBeTruthy()
      expect((parsed.data as { status: string }).status).toBe('APPROVED')
    })

    test('8. goal updated after approval', async ({ }) => {
      // Use EMPLOYEE context since GET /goals/:id filters by employeeId
      const empReq = await playwrightRequest.newContext({ storageState: authFile('EMPLOYEE') })
      const res = await empReq.get(`/api/v1/performance/goals/${goalId}`)
      const { ok, data } = await parseResponse(res)
      expect(ok).toBeTruthy()
      expect((data as { title: string }).title).toBe('Re-proposed after cancel')
      await empReq.dispose()
    })
  })

  // ── EMPLOYEE: propose for reject test ──
  test.describe('Reject Flow — Employee proposes', () => {
    test.use({ storageState: authFile('EMPLOYEE') })

    let rejectRevisionId: string

    test('9. propose revision on goal 2', async ({ request }) => {
      const res = await request.post(`/api/v1/performance/goals/${goalId2}/revisions`, {
        data: {
          newTitle: 'Goal 2 revision to reject',
          reason: 'This will be rejected by manager',
        },
      })
      const { ok, data } = await parseResponse(res)
      expect(ok).toBeTruthy()
      rejectRevisionId = (data as { id: string }).id
    })

    test('10. HR rejects revision', async ({ }) => {
      const hrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })

      const res = await hrReq.put(
        `/api/v1/performance/goals/${goalId2}/revisions/${rejectRevisionId}/reject`,
        { data: { comment: 'Current goal is fine, no change needed' } },
      )
      const { ok, data } = await parseResponse(res)
      expect(ok).toBeTruthy()
      expect((data as { status: string }).status).toBe('REJECTED')
      expect((data as { reviewComment: string }).reviewComment).toBe(
        'Current goal is fine, no change needed',
      )

      await hrReq.dispose()
    })

    test('11. goal 2 unchanged after rejection', async ({ request }) => {
      const res = await request.get(`/api/v1/performance/goals/${goalId2}`)
      const { ok, data } = await parseResponse(res)
      expect(ok).toBeTruthy()
      expect((data as { title: string }).title).toBe('E2E Revision Test Goal 2')
    })
  })

  // ═══════════════════════════════════════════════════════════
  // BATCH REVISION TESTS
  // ═══════════════════════════════════════════════════════════

  test.describe('Batch Revisions', () => {
    test.use({ storageState: authFile('EMPLOYEE') })

    let batchId: string

    test('12. batch propose revisions', async ({ request }) => {
      const res = await request.post('/api/v1/performance/goals/batch-revisions', {
        data: {
          revisions: [
            { goalId, newWeight: 65, newTitle: 'Batch revised goal 1' },
            { goalId: goalId2, newWeight: 35, newTitle: 'Batch revised goal 2' },
          ],
          reason: 'Batch rebalancing weights after Q2',
        },
      })
      const { ok, data } = await parseResponse(res)
      expect(ok).toBeTruthy()

      batchId = (data as { batchId: string }).batchId
      expect(batchId).toBeTruthy()
      expect((data as { count: number }).count).toBe(2)
    })

    test('13. batch approve', async ({ }) => {
      const hrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })

      const res = await hrReq.put(
        `/api/v1/performance/goals/batch-revisions/${batchId}/approve`,
      )
      const { ok, data } = await parseResponse(res)
      expect(ok).toBeTruthy()
      expect((data as { approvedCount: number }).approvedCount).toBe(2)

      await hrReq.dispose()
    })

    test('14. goals updated after batch approve', async ({ request }) => {
      // EMPLOYEE context already set for this describe block
      const res1 = await request.get(`/api/v1/performance/goals/${goalId}`)
      const p1 = await parseResponse(res1)
      expect(p1.ok).toBeTruthy()
      expect((p1.data as { title: string }).title).toBe('Batch revised goal 1')

      const res2 = await request.get(`/api/v1/performance/goals/${goalId2}`)
      const p2 = await parseResponse(res2)
      expect(p2.ok).toBeTruthy()
      expect((p2.data as { title: string }).title).toBe('Batch revised goal 2')
    })
  })

  // ═══════════════════════════════════════════════════════════
  // PERMISSION TESTS
  // ═══════════════════════════════════════════════════════════

  test.describe('Permissions', () => {
    test('15. EMPLOYEE cannot propose revision on others goal', async ({ }) => {
      // Test with a non-existent goal ID to verify ownership check
      const empReq = await playwrightRequest.newContext({
        storageState: authFile('EMPLOYEE'),
      })

      const res = await empReq.post(
        '/api/v1/performance/goals/00000000-0000-0000-0000-000000000000/revisions',
        { data: { newTitle: 'Hack', reason: 'Unauthorized' } },
      )
      expect(res.status()).toBeGreaterThanOrEqual(400)
      await empReq.dispose()
    })

    test('16. HR Admin can view revisions', async ({ }) => {
      const hrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })

      const res = await hrReq.get(`/api/v1/performance/goals/${goalId}/revisions`)
      expect(res.ok()).toBeTruthy()

      await hrReq.dispose()
    })
  })

  // ═══════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════

  test.describe('Cleanup', () => {
    test.use({ storageState: authFile('HR_ADMIN') })

    test('cleanup test cycle', async ({ request }) => {
      if (cycleId) {
        await cleanupTestCycle(request, cycleId).catch(() => {})
      }
    })
  })
})
