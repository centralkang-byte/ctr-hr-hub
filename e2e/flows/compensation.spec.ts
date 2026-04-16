// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compensation & Benefits E2E Tests
// Covers compensation admin (HR_ADMIN) and self-service (EMPLOYEE).
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from '../helpers/auth'
import { waitForLoading, waitForPageReady } from '../helpers/wait-helpers'

// ─── HR_ADMIN tests ─────────────────────────────────────

test.describe('Compensation: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('compensation page loads', async ({ page }) => {
    await assertPageLoads(page, '/compensation')
    await waitForPageReady(page)
  })

  test('off-cycle list loads', async ({ page }) => {
    await assertPageLoads(page, '/compensation/off-cycle')
    await waitForPageReady(page)
  })

  test('off-cycle new form loads', async ({ page }) => {
    await assertPageLoads(page, '/compensation/off-cycle/new')
    await waitForPageReady(page)
  })

  test('benefits admin page loads', async ({ page }) => {
    await assertPageLoads(page, '/benefits')
    await waitForPageReady(page)
  })
})

// ─── EMPLOYEE tests ─────────────────────────────────────

test.describe('Compensation: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('total rewards page loads', async ({ page }) => {
    await assertPageLoads(page, '/my/total-rewards')
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()
  })

  test('my year-end page loads', async ({ page }) => {
    await assertPageLoads(page, '/my/year-end')
    await waitForPageReady(page)
  })
})
