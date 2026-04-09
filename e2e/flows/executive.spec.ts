// ═══════════════════════════════════════════════════════════
// CTR HR Hub — EXECUTIVE Role E2E Tests
// Verifies EXECUTIVE access patterns and RBAC boundaries.
// Middleware classifies EXECUTIVE as MANAGER_UP.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads, assertBlocked } from '../helpers/auth'
import { waitForLoading, waitForPageReady } from '../helpers/wait-helpers'

// ─── EXECUTIVE positive access ──────────────────────────

test.describe('Executive: EXECUTIVE', () => {
  test.use({ storageState: authFile('EXECUTIVE') })

  test('home/dashboard loads', async ({ page }) => {
    await assertPageLoads(page, '/home')
    await waitForPageReady(page)
  })

  test('dashboard renders KPI content', async ({ page }) => {
    await assertPageLoads(page, '/home')
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
  })

  test('analytics overview loads', async ({ page }) => {
    await assertPageLoads(page, '/analytics')
    await waitForPageReady(page)
  })

  test('workforce analytics loads', async ({ page }) => {
    await assertPageLoads(page, '/analytics/workforce')
    await waitForPageReady(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
  })

  test('performance page loads', async ({ page }) => {
    await assertPageLoads(page, '/performance')
    await waitForPageReady(page)
  })

  test('performance goals read-only', async ({ page }) => {
    await assertPageLoads(page, '/performance/goals')
    await waitForPageReady(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()
  })

  test('recognition page loads', async ({ page }) => {
    await assertPageLoads(page, '/performance/recognition')
    await waitForPageReady(page)
  })

  // Codex HIGH: middleware allows MANAGER_UP → /manager-hub,
  // but page only checks MANAGER/HR_ADMIN/SUPER_ADMIN → redirects EXECUTIVE to /
  test('manager-hub redirects (page excludes EXECUTIVE)', async ({ page }) => {
    await page.goto('/manager-hub', { waitUntil: 'domcontentloaded', timeout: 45000 })
    // Page-level redirect to / (not middleware block)
    await page.waitForURL(/\/(home|ko|en)?$/, { timeout: 10000 })
  })

  test('blocked from settings', async ({ page }) => {
    await assertBlocked(page, '/settings')
  })

  test('blocked from employee create', async ({ page }) => {
    await assertBlocked(page, '/employees/new')
  })

  test('blocked from payroll admin', async ({ page }) => {
    await assertBlocked(page, '/payroll')
  })
})
