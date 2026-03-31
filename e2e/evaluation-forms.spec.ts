// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Evaluation Forms E2E Tests
//
// Tests UI form rendering and page accessibility for
// evaluation-related pages across different roles.
//
// These tests verify that forms load correctly and display
// the expected elements. Full form submission tests are in
// evaluation-lifecycle.spec.ts (API level).
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from './helpers/auth'
import { waitForPageReady, waitForLoading } from './helpers/wait-helpers'

// ─── EMPLOYEE: Self-evaluation page ─────────────────────────

test.describe('Eval Forms: EMPLOYEE self-evaluation', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('can access self-eval page', async ({ page }) => {
    await assertPageLoads(page, '/performance/self-eval')
    await waitForPageReady(page)
    await waitForLoading(page)

    // Page should render without error boundary
    await expect(page.locator('text=페이지를 불러올 수 없습니다')).not.toBeVisible()
    await expect(page.locator('main')).toBeVisible()
  })

  test('can access my-evaluation page', async ({ page }) => {
    await assertPageLoads(page, '/performance/my-evaluation')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('text=페이지를 불러올 수 없습니다')).not.toBeVisible()
    await expect(page.locator('main')).toBeVisible()
  })

  test('can access my-goals page', async ({ page }) => {
    await assertPageLoads(page, '/performance/my-goals')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('text=페이지를 불러올 수 없습니다')).not.toBeVisible()
    await expect(page.locator('main')).toBeVisible()
  })

  test('can access my-result page', async ({ page }) => {
    await assertPageLoads(page, '/performance/my-result')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('text=페이지를 불러올 수 없습니다')).not.toBeVisible()
    await expect(page.locator('main')).toBeVisible()
  })

  test('can access peer review page', async ({ page }) => {
    await assertPageLoads(page, '/performance/peer-review')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('text=페이지를 불러올 수 없습니다')).not.toBeVisible()
    await expect(page.locator('main')).toBeVisible()
  })

  test('can access recognition page', async ({ page }) => {
    await assertPageLoads(page, '/performance/recognition')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('text=페이지를 불러올 수 없습니다')).not.toBeVisible()
    await expect(page.locator('main')).toBeVisible()
  })

  test('self-eval GET API returns data', async ({ request }) => {
    // Get list of cycles first to find a valid cycleId
    const cyclesRes = await request.get('/api/v1/performance/cycles')
    if (!cyclesRes.ok()) return // No cycles available, skip

    const body = await cyclesRes.json() as { data?: Array<{ id: string }> }
    const cycles = body.data
    if (!cycles || cycles.length === 0) return

    // Try to get self-evaluation for the first cycle
    const cycleId = cycles[0].id
    const evalRes = await request.get(
      `/api/v1/performance/evaluations/self?cycleId=${cycleId}`,
    )
    // Should return 200 (with data or null) — NOT 403
    expect(evalRes.status()).toBeLessThan(400)
  })
})

// ─── MANAGER: Team evaluation pages ─────────────────────────

test.describe('Eval Forms: MANAGER team views', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('can access team-goals page', async ({ page }) => {
    await assertPageLoads(page, '/performance/team-goals')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('text=페이지를 불러올 수 없습니다')).not.toBeVisible()
    await expect(page.locator('main')).toBeVisible()
  })

  test('can access team-results page', async ({ page }) => {
    await assertPageLoads(page, '/performance/team-results')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('text=페이지를 불러올 수 없습니다')).not.toBeVisible()
    await expect(page.locator('main')).toBeVisible()
  })

  test('can access manager-evaluation page', async ({ page }) => {
    await assertPageLoads(page, '/performance/manager-evaluation')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('text=페이지를 불러올 수 없습니다')).not.toBeVisible()
    await expect(page.locator('main')).toBeVisible()
  })

  test('manager GET evaluations API returns data', async ({ request }) => {
    // Get cycles to find valid cycleId
    const cyclesRes = await request.get('/api/v1/performance/cycles')
    if (!cyclesRes.ok()) return

    const body = await cyclesRes.json() as { data?: Array<{ id: string }> }
    const cycles = body.data
    if (!cycles || cycles.length === 0) return

    const cycleId = cycles[0].id
    const evalRes = await request.get(
      `/api/v1/performance/evaluations/manager?cycleId=${cycleId}`,
    )
    // Should return 200 — manager has access to team evaluations
    expect(evalRes.status()).toBeLessThan(400)
  })
})

// ─── HR_ADMIN: Admin evaluation pages ───────────────────────

test.describe('Eval Forms: HR_ADMIN admin views', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('can access performance admin hub', async ({ page }) => {
    await assertPageLoads(page, '/performance/admin')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8000 })
  })

  test('can access cycle list page', async ({ page }) => {
    await assertPageLoads(page, '/performance/cycles')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('main')).toBeVisible()
  })

  test('can access calibration page', async ({ page }) => {
    await assertPageLoads(page, '/performance/calibration')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 8000 })
  })

  test('can access goals management page', async ({ page }) => {
    await assertPageLoads(page, '/performance/goals')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 8000 })
  })

  test('cycles API returns paginated data', async ({ request }) => {
    const res = await request.get('/api/v1/performance/cycles')
    expect(res.ok()).toBe(true)

    const body = await res.json() as { data?: unknown[]; pagination?: unknown }
    expect(body.data).toBeDefined()
    expect(body.pagination).toBeDefined()
  })
})
