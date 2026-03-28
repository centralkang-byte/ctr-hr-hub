// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Performance Management E2E Tests
// Uses storageState for session reuse.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from './helpers/auth'
import { waitForLoading, waitForPageReady } from './helpers/wait-helpers'

// ─── HR_ADMIN tests ──────────────────────────────────────

test.describe('Performance: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('can view performance dashboard', async ({ page }) => {
    await assertPageLoads(page, '/performance')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 8000 })
  })

  test('can view goals page', async ({ page }) => {
    await assertPageLoads(page, '/performance/goals')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 8000 })

    // Cycle selector — select or combobox
    const cycleSelect = page.locator('select').or(page.locator('[role="combobox"]')).first()
    await expect(cycleSelect).toBeVisible({ timeout: 8000 })
  })

  test('can view calibration page', async ({ page }) => {
    await assertPageLoads(page, '/performance/calibration')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 8000 })
  })

  test('can view peer review page', async ({ page }) => {
    await assertPageLoads(page, '/performance/peer-review')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('text=페이지를 불러올 수 없습니다')).not.toBeVisible()
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
  })

  test('can view 1:1 meetings page', async ({ page }) => {
    await assertPageLoads(page, '/performance/one-on-one')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('text=페이지를 불러올 수 없습니다')).not.toBeVisible()
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
  })

  test('can view recognition page', async ({ page }) => {
    await assertPageLoads(page, '/performance/recognition')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('text=페이지를 불러올 수 없습니다')).not.toBeVisible()
    await expect(page.locator('main')).toBeVisible()
  })
})

// ─── MANAGER tests ───────────────────────────────────────

test.describe('Performance: MANAGER', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('can view goals page', async ({ page }) => {
    await assertPageLoads(page, '/performance/goals')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 8000 })

    const cycleSelect = page.locator('select').or(page.locator('[role="combobox"]')).first()
    await expect(cycleSelect).toBeVisible({ timeout: 8000 })
  })

  test('can view peer review page', async ({ page }) => {
    await assertPageLoads(page, '/performance/peer-review')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('text=페이지를 불러올 수 없습니다')).not.toBeVisible()
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
  })
})
