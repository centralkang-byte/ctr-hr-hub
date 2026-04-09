// ═══════════════════════════════════════════════════════════
// CTR HR Hub — My Space & Manager Hub E2E Tests
// Self-service pages (EMPLOYEE) and team management (MANAGER).
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads, assertBlocked } from '../helpers/auth'
import { waitForLoading, waitForPageReady } from '../helpers/wait-helpers'

// ─── EMPLOYEE self-service ──────────────────────────────

test.describe('My Space: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('my tasks page loads', async ({ page }) => {
    await assertPageLoads(page, '/my/tasks')
    await waitForPageReady(page)
  })

  test('my tasks approvals tab loads', async ({ page }) => {
    await assertPageLoads(page, '/my/tasks?tab=approvals')
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()
  })

  test('my profile page loads', async ({ page }) => {
    await assertPageLoads(page, '/my/profile')
    await waitForPageReady(page)
  })

  test('my documents page loads', async ({ page }) => {
    await assertPageLoads(page, '/my/documents')
    await waitForPageReady(page)
  })

  test('my benefits page loads', async ({ page }) => {
    await assertPageLoads(page, '/my/benefits')
    await waitForPageReady(page)
  })

  test('my skills page loads', async ({ page }) => {
    await assertPageLoads(page, '/my/skills')
    await waitForPageReady(page)
  })

  test('my training page loads', async ({ page }) => {
    await assertPageLoads(page, '/my/training')
    await waitForPageReady(page)
  })

  test('notification settings loads', async ({ page }) => {
    await assertPageLoads(page, '/my/settings/notifications')
    await waitForPageReady(page)
  })

  test('notifications page loads with list', async ({ page }) => {
    await assertPageLoads(page, '/notifications')
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
  })

  test('blocked from manager-hub', async ({ page }) => {
    await assertBlocked(page, '/manager-hub')
  })

  test('blocked from attendance admin', async ({ page }) => {
    await assertBlocked(page, '/attendance/admin')
  })
})

// ─── MANAGER team management ────────────────────────────

test.describe('My Space: MANAGER', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('my tasks shows items', async ({ page }) => {
    await assertPageLoads(page, '/my/tasks')
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()
  })

  test('manager hub page loads', async ({ page }) => {
    await assertPageLoads(page, '/manager-hub')
    await waitForPageReady(page)
  })

  test('manager hub renders team content', async ({ page }) => {
    await assertPageLoads(page, '/manager-hub')
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
  })

  test('team attendance page loads', async ({ page }) => {
    await assertPageLoads(page, '/attendance/team')
    await waitForPageReady(page)
  })

  test('delegation settings loads', async ({ page }) => {
    await assertPageLoads(page, '/delegation/settings')
    await waitForPageReady(page)
  })

  test('one-on-one page loads', async ({ page }) => {
    await assertPageLoads(page, '/performance/one-on-one')
    await waitForPageReady(page)
  })
})
