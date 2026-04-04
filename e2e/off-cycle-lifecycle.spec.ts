// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Off-Cycle Compensation Lifecycle E2E Tests
// Covers: CRUD, state transitions, RBAC, approval workflow
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from './helpers/auth'
import { waitForLoading } from './helpers/wait-helpers'
import {
  createOffCycleDraft,
  submitOffCycle,
  approveOffCycle,
  rejectOffCycle,
  cancelOffCycle,
  reviseOffCycle,
  getOffCycleDetail,
} from './helpers/off-cycle-fixtures'

const BASE_URL = '/api/v1/compensation/off-cycle'

// ─── Helper: resolve employee ID ────────────────────────────

async function resolveEmployeeId(
  request: import('@playwright/test').APIRequestContext,
  name: string,
): Promise<string> {
  const res = await request.get(`/api/v1/employees?search=${encodeURIComponent(name)}&limit=1`)
  const body = await res.json()
  const emp = body.data?.[0]
  if (!emp) throw new Error(`Employee "${name}" not found in seed data`)
  return emp.id
}

// ─── HR_ADMIN: Page navigation ──────────────────────────────

test.describe('Off-Cycle: HR_ADMIN Pages', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('can view off-cycle list page', async ({ page }) => {
    await assertPageLoads(page, '/compensation/off-cycle')
    await waitForLoading(page)
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 15000 })
  })

  test('can view new request page', async ({ page }) => {
    await assertPageLoads(page, '/compensation/off-cycle/new')
    await waitForLoading(page)
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 15000 })
  })
})

// ─── HR_ADMIN: API Lifecycle ────────────────────────────────

test.describe('Off-Cycle: API Lifecycle', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  let employeeId: string

  test.beforeAll(async ({ request }) => {
    employeeId = await resolveEmployeeId(request, '이민준')
  })

  test('create DRAFT off-cycle request', async ({ request }) => {
    const draft = await createOffCycleDraft(request, { employeeId })
    expect(draft).toBeDefined()
    expect(draft.id).toBeTruthy()
    expect(draft.status).toBe('DRAFT')

    // Cleanup
    await cancelOffCycle(request, draft.id)
  })

  test('submit DRAFT → PENDING_APPROVAL or APPROVED', async ({ request }) => {
    const draft = await createOffCycleDraft(request, { employeeId })
    await submitOffCycle(request, draft.id)

    const detail = await getOffCycleDetail(request, draft.id)
    // Could be PENDING_APPROVAL or APPROVED (self-approval skip)
    expect(['PENDING_APPROVAL', 'APPROVED']).toContain(detail.status)

    // Cleanup
    if (detail.status !== 'APPROVED') {
      await cancelOffCycle(request, draft.id)
    }
  })

  test('full lifecycle: create → submit → approve', async ({ request }) => {
    const draft = await createOffCycleDraft(request, {
      employeeId,
      reasonCategory: 'RETENTION',
      proposedSalary: 55_000_000 + (Date.now() % 100_000),
    })
    await submitOffCycle(request, draft.id)

    const afterSubmit = await getOffCycleDetail(request, draft.id)
    if (afterSubmit.status === 'PENDING_APPROVAL') {
      await approveOffCycle(request, draft.id, 'E2E approval test')
    }

    const afterApprove = await getOffCycleDetail(request, draft.id)
    expect(afterApprove.status).toBe('APPROVED')
  })

  test('reject → revise cycle', async ({ request }) => {
    const draft = await createOffCycleDraft(request, { employeeId })
    await submitOffCycle(request, draft.id)

    const afterSubmit = await getOffCycleDetail(request, draft.id)
    if (afterSubmit.status === 'PENDING_APPROVAL') {
      await rejectOffCycle(request, draft.id, 'E2E rejection test reason')

      const afterReject = await getOffCycleDetail(request, draft.id)
      expect(afterReject.status).toBe('REJECTED')

      await reviseOffCycle(request, draft.id)

      const afterRevise = await getOffCycleDetail(request, draft.id)
      expect(afterRevise.status).toBe('DRAFT')

      // Cleanup
      await cancelOffCycle(request, draft.id)
    } else {
      // Self-approved — skip rejection tests
      expect(afterSubmit.status).toBe('APPROVED')
    }
  })

  test('cancel from DRAFT', async ({ request }) => {
    const draft = await createOffCycleDraft(request, { employeeId })
    await cancelOffCycle(request, draft.id)

    const detail = await getOffCycleDetail(request, draft.id)
    expect(detail.status).toBe('CANCELLED')
  })

  test('cancel from PENDING_APPROVAL', async ({ request }) => {
    const draft = await createOffCycleDraft(request, { employeeId })
    await submitOffCycle(request, draft.id)

    const afterSubmit = await getOffCycleDetail(request, draft.id)
    if (afterSubmit.status === 'PENDING_APPROVAL') {
      await cancelOffCycle(request, draft.id)

      const afterCancel = await getOffCycleDetail(request, draft.id)
      expect(afterCancel.status).toBe('CANCELLED')
    }
  })

  test('GET list returns paginated data', async ({ request }) => {
    const res = await request.get(BASE_URL)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
    expect(Array.isArray(body.data)).toBe(true)
  })

  test('GET list filters by status', async ({ request }) => {
    const res = await request.get(`${BASE_URL}?status=APPROVED`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.data)).toBe(true)
    for (const req of body.data) {
      expect(req.status).toBe('APPROVED')
    }
  })
})

// ─── RBAC: EMPLOYEE blocked ─────────────────────────────────

test.describe('Off-Cycle: RBAC - EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('EMPLOYEE blocked from off-cycle list page', async ({ page }) => {
    const res = await page.goto('/compensation/off-cycle')
    // Should redirect or return error (HR_UP only)
    const url = page.url()
    expect(url).not.toContain('/compensation/off-cycle')
  })

  test('EMPLOYEE blocked from off-cycle API GET', async ({ request }) => {
    const res = await request.get(BASE_URL)
    // Expect 403 or 401
    expect([401, 403]).toContain(res.status())
  })

  test('EMPLOYEE blocked from off-cycle API POST', async ({ request }) => {
    const res = await request.post(BASE_URL, {
      data: {
        employeeId: 'fake-id',
        reasonCategory: 'PROMOTION',
        proposedSalary: 50_000_000,
        effectiveDate: '2026-06-01',
        justification: 'test',
        submitForApproval: false,
      },
    })
    expect([401, 403]).toContain(res.status())
  })
})

// ─── RBAC: MANAGER limited scope ────────────────────────────

test.describe('Off-Cycle: RBAC - MANAGER', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('MANAGER can access off-cycle list', async ({ request }) => {
    const res = await request.get(BASE_URL)
    expect(res.status()).toBe(200)
  })

  test('MANAGER can create request for direct report', async ({ request }) => {
    // 이민준 reports to 박준혁 (MANAGER)
    const employeeId = await resolveEmployeeId(request, '이민준')
    const draft = await createOffCycleDraft(request, { employeeId })
    expect(draft).toBeDefined()
    expect(draft.status).toBe('DRAFT')

    // Cleanup
    await cancelOffCycle(request, draft.id)
  })
})
