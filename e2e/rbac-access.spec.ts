// ═══════════════════════════════════════════════════════════
// CTR HR Hub — RBAC Access Control E2E Tests
//
// Verifies that middleware enforces role-based access:
// - Allowed routes load without redirecting to login or error
// - Forbidden routes redirect to / (with ?error=forbidden)
//
// Uses storageState for session reuse (no per-test loginAs).
// ═══════════════════════════════════════════════════════════

import { test, expect, type Page } from '@playwright/test'
import { authFile, assertPageLoads } from './helpers/auth'
import { waitForPageReady } from './helpers/wait-helpers'

// ─── Helper: assert a route is blocked ──────────────────────
async function assertBlocked(page: Page, path: string) {
  await page.goto(path)
  await waitForPageReady(page)

  const url = page.url()
  const isForbiddenPath = url.includes(path)
  const isRedirectedAway = url.includes('error=forbidden') || url.includes('/login') || !isForbiddenPath

  expect(isRedirectedAway, `Expected ${path} to be blocked but URL was: ${url}`).toBe(true)
}

// ─── EMPLOYEE ────────────────────────────────────────────────

test.describe('RBAC: EMPLOYEE role', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('can access /home', async ({ page }) => {
    await assertPageLoads(page, '/home')
  })

  test('can access /leave', async ({ page }) => {
    await assertPageLoads(page, '/leave')
  })

  test('can access /payroll/me (own payslips)', async ({ page }) => {
    await assertPageLoads(page, '/payroll/me')
  })

  test('can access /onboarding/me', async ({ page }) => {
    await assertPageLoads(page, '/onboarding/me')
  })

  test('can access /approvals/inbox', async ({ page }) => {
    await assertPageLoads(page, '/approvals/inbox')
  })

  test('is blocked from /employees', async ({ page }) => {
    await assertBlocked(page, '/employees')
  })

  test('is blocked from /payroll (admin)', async ({ page }) => {
    await assertBlocked(page, '/payroll')
  })

  test('is blocked from /recruitment', async ({ page }) => {
    await assertBlocked(page, '/recruitment')
  })

  test('is blocked from /settings', async ({ page }) => {
    await assertBlocked(page, '/settings')
  })

  test('is blocked from /compliance', async ({ page }) => {
    await assertBlocked(page, '/compliance')
  })
})

// ─── MANAGER ─────────────────────────────────────────────────

test.describe('RBAC: MANAGER role', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('can access /analytics', async ({ page }) => {
    await assertPageLoads(page, '/analytics')
  })

  test('can access /performance/goals', async ({ page }) => {
    await assertPageLoads(page, '/performance/goals')
  })

  test('can access /performance/peer-review', async ({ page }) => {
    await assertPageLoads(page, '/performance/peer-review')
  })

  test('is blocked from /employees', async ({ page }) => {
    await assertBlocked(page, '/employees')
  })

  test('is blocked from /payroll (admin)', async ({ page }) => {
    await assertBlocked(page, '/payroll')
  })

  test('is blocked from /recruitment', async ({ page }) => {
    await assertBlocked(page, '/recruitment')
  })

  test('is blocked from /settings', async ({ page }) => {
    await assertBlocked(page, '/settings')
  })
})

// ─── HR_ADMIN ────────────────────────────────────────────────

test.describe('RBAC: HR_ADMIN role', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('can access /employees', async ({ page }) => {
    await assertPageLoads(page, '/employees')
  })

  test('can access /payroll', async ({ page }) => {
    await assertPageLoads(page, '/payroll')
  })

  test('can access /recruitment', async ({ page }) => {
    await assertPageLoads(page, '/recruitment')
  })

  test('can access /settings', async ({ page }) => {
    await assertPageLoads(page, '/settings')
  })

  test('can access /compliance', async ({ page }) => {
    await assertPageLoads(page, '/compliance')
  })
})

// ─── SUPER_ADMIN ──────────────────────────────────────────────

test.describe('RBAC: SUPER_ADMIN role', () => {
  test.use({ storageState: authFile('SUPER_ADMIN') })

  test('can access /home', async ({ page }) => {
    await assertPageLoads(page, '/home')
  })

  test('can access /employees', async ({ page }) => {
    await assertPageLoads(page, '/employees')
  })

  test('can access /payroll', async ({ page }) => {
    await assertPageLoads(page, '/payroll')
  })

  test('can access /recruitment', async ({ page }) => {
    await assertPageLoads(page, '/recruitment')
  })

  test('can access /settings', async ({ page }) => {
    await assertPageLoads(page, '/settings')
  })

  test('can access /compliance', async ({ page }) => {
    await assertPageLoads(page, '/compliance')
  })

  test('can access /analytics', async ({ page }) => {
    await assertPageLoads(page, '/analytics')
  })

  test('can access /performance/goals', async ({ page }) => {
    await assertPageLoads(page, '/performance/goals')
  })
})
