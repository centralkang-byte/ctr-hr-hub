// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Performance Deep E2E Tests
// Covers my-* self-service (EMPLOYEE), team (MANAGER), admin (HR_ADMIN).
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from '../helpers/auth'
import { waitForLoading, waitForPageReady } from '../helpers/wait-helpers'

// ─── EMPLOYEE self-service ──────────────────────────────

test.describe('Performance Deep: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('my goals page loads', async ({ page }) => {
    await assertPageLoads(page, '/performance/my-goals')
    await waitForPageReady(page)
  })

  test('my evaluation page loads', async ({ page }) => {
    await assertPageLoads(page, '/performance/my-evaluation')
    await waitForPageReady(page)
  })

  test('my quarterly review loads', async ({ page }) => {
    await assertPageLoads(page, '/performance/my-quarterly-review')
    await waitForPageReady(page)
  })

  test('my result page loads', async ({ page }) => {
    await assertPageLoads(page, '/performance/my-result')
    await waitForPageReady(page)
  })

  test('my checkins page loads', async ({ page }) => {
    await assertPageLoads(page, '/performance/my-checkins')
    await waitForPageReady(page)
  })
})

// ─── MANAGER team views ─────────────────────────────────

test.describe('Performance Deep: MANAGER', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('team goals page loads', async ({ page }) => {
    await assertPageLoads(page, '/performance/team-goals')
    await waitForPageReady(page)
  })

  test('team results page loads', async ({ page }) => {
    await assertPageLoads(page, '/performance/team-results')
    await waitForPageReady(page)
  })
})

// ─── HR_ADMIN admin views ───────────────────────────────

test.describe('Performance Deep: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('performance admin loads', async ({ page }) => {
    await assertPageLoads(page, '/performance/admin')
    await waitForPageReady(page)
  })

  test('calibration page loads', async ({ page }) => {
    await assertPageLoads(page, '/performance/calibration')
    await waitForPageReady(page)
  })

  test('quarterly reviews admin loads', async ({ page }) => {
    await assertPageLoads(page, '/performance/quarterly-reviews')
    await waitForPageReady(page)
  })

  test('pulse survey page loads', async ({ page }) => {
    await assertPageLoads(page, '/performance/pulse')
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()
  })
})
