// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll Pipeline E2E Tests
// Uses storageState for session reuse.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from '../helpers/auth'
import { waitForLoading, waitForPageReady } from '../helpers/wait-helpers'

// ─── HR_ADMIN tests ──────────────────────────────────────

test.describe('Payroll: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('can view payroll dashboard', async ({ page }) => {
    await assertPageLoads(page, '/payroll')
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 })
  })

  test('can see payroll create button', async ({ page }) => {
    await assertPageLoads(page, '/payroll')
    await waitForLoading(page)

    // Payroll dashboard should have a create/run button
    const createButton = page.getByRole('button', { name: /급여 실행|실행|Create/i }).first()
    await expect(createButton).toBeVisible({ timeout: 15000 })
  })

  test('can view payroll adjustments', async ({ page }) => {
    await assertPageLoads(page, '/payroll/adjustments')
    await waitForPageReady(page)

    const content = page.locator('h1, h2').or(page.getByText(/조정|Adjustment|수당/)).first()
    await expect(content).toBeVisible({ timeout: 10000 })
  })

  test('can view payroll import page', async ({ page }) => {
    await assertPageLoads(page, '/payroll/import')
    await waitForPageReady(page)

    const content = page.locator('h1, h2').or(page.getByText(/임포트|Import|업로드|Upload/)).first()
    await expect(content).toBeVisible({ timeout: 10000 })
  })

  test('can view salary simulation page', async ({ page }) => {
    await assertPageLoads(page, '/payroll/simulation')
    await waitForPageReady(page)

    // Simulation page should render
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
  })
})

// ─── EMPLOYEE tests ──────────────────────────────────────

test.describe('Payroll: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('can view own payslips on /payroll/me', async ({ page }) => {
    await assertPageLoads(page, '/payroll/me')
    await waitForLoading(page)

    const heading = page.locator('h1, h2').or(page.getByText(/급여명세서|Payslip|내 급여/)).first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  test('can see payslip content on /payroll/me', async ({ page }) => {
    await assertPageLoads(page, '/payroll/me')
    await waitForLoading(page)

    // Either payslip cards or empty state
    const main = page.locator('main')
    await expect(main).toBeVisible()

    // No error boundary
    await expect(page.locator('text=페이지를 불러올 수 없습니다')).not.toBeVisible()
  })
})

// ─── MANAGER test ────────────────────────────────────────

test.describe('Payroll: MANAGER', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('is blocked from /payroll admin dashboard', async ({ page }) => {
    await page.goto('/payroll')
    await waitForPageReady(page)

    const currentUrl = page.url()
    const isBlockedOrRedirected =
      currentUrl.includes('error=forbidden') ||
      currentUrl.includes('/login') ||
      currentUrl.includes('/home') ||
      !currentUrl.includes('/payroll')

    expect(
      isBlockedOrRedirected,
      `Expected MANAGER to be blocked from /payroll but URL was: ${currentUrl}`,
    ).toBe(true)
  })
})
