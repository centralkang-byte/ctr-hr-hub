// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Evaluation Permissions E2E Tests
//
// Verifies RBAC boundaries for performance/evaluation routes.
// Each role should only access resources within their scope.
// ═══════════════════════════════════════════════════════════

import { test, expect, type Page } from '@playwright/test'
import { authFile, assertPageLoads } from './helpers/auth'
import { waitForPageReady } from './helpers/wait-helpers'

// ─── Helper: assert a page route is blocked ─────────────────

async function assertBlocked(page: Page, path: string) {
  await page.goto(path)
  await waitForPageReady(page)

  const url = page.url()
  const isForbiddenPath = url.includes(path)
  const isRedirectedAway =
    url.includes('error=forbidden') ||
    url.includes('/login') ||
    !isForbiddenPath

  expect(
    isRedirectedAway,
    `Expected ${path} to be blocked but URL was: ${url}`,
  ).toBe(true)
}

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
  })
})
