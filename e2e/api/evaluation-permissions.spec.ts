// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Evaluation Permissions E2E Tests
//
// Verifies RBAC boundaries for performance/evaluation routes.
// Each role should only access resources within their scope.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads, assertBlocked } from '../helpers/auth'
import { expectQueryBudget } from '../helpers/query-budget'

// ─── EMPLOYEE boundaries ────────────────────────────────────

test.describe('Eval Permissions: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('is blocked from /performance/admin', async ({ page }) => {
    await assertBlocked(page, '/performance/admin')
  })

  test('is blocked from /performance/calibration', async ({ page }) => {
    await assertBlocked(page, '/performance/calibration')
  })

  test('can access /performance (own dashboard)', async ({ page }) => {
    await assertPageLoads(page, '/performance')
    await expect(page.locator('main')).toBeVisible()
  })

  test('cannot advance cycle via API', async ({ request }) => {
    const res = await request.put('/api/v1/performance/cycles/nonexistent/advance')
    expect(res.ok()).toBe(false)
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test('cannot create calibration session via API', async ({ request }) => {
    const res = await request.post('/api/v1/performance/calibration/sessions', {
      data: { cycleId: 'nonexistent', departmentId: 'nonexistent' },
    })
    expect(res.ok()).toBe(false)
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test('cannot access admin results via API', async ({ request }) => {
    const res = await request.get('/api/v1/performance/results/admin')
    expect(res.ok()).toBe(false)
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })
})

// ─── MANAGER boundaries ─────────────────────────────────────

test.describe('Eval Permissions: MANAGER', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('is blocked from /performance/admin', async ({ page }) => {
    await assertBlocked(page, '/performance/admin')
  })

  test('is blocked from /performance/calibration', async ({ page }) => {
    await assertBlocked(page, '/performance/calibration')
  })

  test('can access /performance (own dashboard)', async ({ page }) => {
    await assertPageLoads(page, '/performance')
    await expect(page.locator('main')).toBeVisible()
  })

  test('can access /performance/team-goals', async ({ page }) => {
    await assertPageLoads(page, '/performance/team-goals')
    await expect(page.locator('main')).toBeVisible()
  })

  test('cannot advance cycle via API', async ({ request }) => {
    const res = await request.put('/api/v1/performance/cycles/nonexistent/advance')
    expect(res.ok()).toBe(false)
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test('cannot access admin results via API', async ({ request }) => {
    const res = await request.get('/api/v1/performance/results/admin')
    expect(res.ok()).toBe(false)
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })
})

// ─── HR_ADMIN full access ───────────────────────────────────

test.describe('Eval Permissions: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('can access /performance/admin', async ({ page }) => {
    await assertPageLoads(page, '/performance/admin')
    await expect(page.locator('main')).toBeVisible()
  })

  test('can access /performance/calibration', async ({ page }) => {
    await assertPageLoads(page, '/performance/calibration')
    await expect(page.locator('main')).toBeVisible()
  })

  test('can access /performance/cycles', async ({ page }) => {
    await assertPageLoads(page, '/performance/cycles')
    await expect(page.locator('main')).toBeVisible()
  })

  test('can list cycles via API', async ({ request }) => {
    const res = await request.get('/api/v1/performance/cycles')
    expect(res.ok()).toBe(true)
    expect(res.status()).toBe(200)
    // Phase 6A baseline budget — TODO(session-164): tighten after observing
    // actual count in first PRISMA_QUERY_DEBUG=1 CI run.
    await expectQueryBudget(res, 999, 'GET /api/v1/performance/cycles')
  })
})
