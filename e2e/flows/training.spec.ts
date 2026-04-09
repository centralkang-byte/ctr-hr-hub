// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Training & Discipline E2E Tests
// Admin pages (HR_ADMIN) and RBAC boundaries (EMPLOYEE).
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads, assertBlocked } from '../helpers/auth'
import { waitForLoading, waitForPageReady } from '../helpers/wait-helpers'

// ─── HR_ADMIN tests ─────────────────────────────────────

test.describe('Training: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('discipline page loads', async ({ page }) => {
    await assertPageLoads(page, '/discipline')
    await waitForPageReady(page)
  })

  test('discipline rewards page loads', async ({ page }) => {
    await assertPageLoads(page, '/discipline/rewards')
    await waitForPageReady(page)
  })

  test('training admin page loads', async ({ page }) => {
    await assertPageLoads(page, '/training')
    await waitForPageReady(page)
  })

  test('training renders course list', async ({ page }) => {
    await assertPageLoads(page, '/training')
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
  })
})

// ─── EMPLOYEE tests ─────────────────────────────────────

test.describe('Training: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('my training renders enrollments', async ({ page }) => {
    await assertPageLoads(page, '/my/training')
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()
  })

  // RBAC boundary: discipline is HR_UP only
  test('blocked from discipline', async ({ page }) => {
    await assertBlocked(page, '/discipline')
  })

  // RBAC boundary: offboarding exit-interviews is HR_UP only
  test('blocked from offboarding exit-interviews', async ({ page }) => {
    await assertBlocked(page, '/offboarding/exit-interviews')
  })
})
