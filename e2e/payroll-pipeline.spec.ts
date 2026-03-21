// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll Pipeline E2E Tests
// Covers HR admin payroll management, employee self-service,
// and RBAC access control for payroll routes.
//
// Requires:
//   1. Dev server running (npm run dev)
//   2. NEXT_PUBLIC_SHOW_TEST_ACCOUNTS=true in .env
//   3. Seeded test accounts
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { loginAs, assertPageLoads } from './helpers/auth'
import { waitForLoading, waitForPageReady, waitForTableRows } from './helpers/wait-helpers'

test.describe('Payroll', () => {
  // ─── HR Admin: Payroll Dashboard ─────────────────────────

  test('HR_ADMIN can view payroll dashboard', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/payroll')
    await waitForLoading(page)

    // Dashboard renders KPI summary cards or pipeline visualization
    const dashboardContent = page.locator(
      '[class*="card"], [class*="Card"], text=총 실수령액, text=완료 법인, text=급여 실행, [class*="pipeline"], [class*="Pipeline"]',
    ).first()
    await expect(dashboardContent).toBeVisible({ timeout: 15000 })
  })

  // ─── HR Admin: Open Payroll Create Dialog ─────────────────

  test('HR_ADMIN can open payroll create dialog', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/payroll')
    await waitForLoading(page)

    // Click the "급여 실행 생성" button
    const createButton = page.locator(
      'button:has-text("급여 실행 생성"), button:has-text("급여 실행"), button:has-text("Create"), button:has-text("실행")',
    ).first()
    await expect(createButton).toBeVisible({ timeout: 15000 })
    await createButton.click()

    // Dialog should appear
    const dialog = page.locator('[role="dialog"]').first()
    await expect(dialog).toBeVisible({ timeout: 5000 })
  })

  // ─── HR Admin: Payroll Adjustments ───────────────────────

  test('HR_ADMIN can view payroll adjustments', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/payroll/adjustments')
    await waitForPageReady(page)

    // Page should render heading or content area
    const content = page.locator(
      'h1, h2, text=조정, text=Adjustment, text=수당, [class*="card"], [class*="Card"], table',
    ).first()
    await expect(content).toBeVisible({ timeout: 10000 })
  })

  // ─── HR Admin: Payroll Import ─────────────────────────────

  test('HR_ADMIN can view payroll import page', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/payroll/import')
    await waitForPageReady(page)

    // Import page should render heading or upload area
    const content = page.locator(
      'h1, h2, text=임포트, text=Import, text=업로드, text=Upload, [class*="upload"], [class*="Upload"], [class*="dropzone"]',
    ).first()
    await expect(content).toBeVisible({ timeout: 10000 })
  })

  // ─── HR Admin: Salary Simulation ─────────────────────────

  test('HR_ADMIN can view salary simulation with individual and bulk tabs', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/payroll/simulation')
    await waitForPageReady(page)

    // Both individual (개별 시뮬레이션) and bulk (일괄 시뮬레이션) mode buttons should be visible
    const singleTab = page.locator(
      'button:has-text("개별 시뮬레이션"), button:has-text("개별"), button:has-text("Single"), [role="tab"]:has-text("개별")',
    ).first()
    await expect(singleTab).toBeVisible({ timeout: 10000 })

    const bulkTab = page.locator(
      'button:has-text("일괄 시뮬레이션"), button:has-text("일괄"), button:has-text("Bulk"), [role="tab"]:has-text("일괄")',
    ).first()
    await expect(bulkTab).toBeVisible({ timeout: 10000 })
  })

  // ─── Employee: Own Payslips ────────────────────────────────

  test('EMPLOYEE can view own payslips on /payroll/me', async ({ page }) => {
    await loginAs(page, 'EMPLOYEE')
    await assertPageLoads(page, '/payroll/me')
    await waitForLoading(page)

    // Page header with payslip title should be visible
    const heading = page.locator(
      'h1, h2, text=급여명세서, text=Payslip, text=내 급여, [class*="heading"]',
    ).first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  // ─── Employee: Payslip Cards Rendered ─────────────────────

  test('EMPLOYEE can see payslip cards or list items on /payroll/me', async ({ page }) => {
    await loginAs(page, 'EMPLOYEE')
    await assertPageLoads(page, '/payroll/me')
    await waitForLoading(page)

    // Either payslip cards are shown (seeded data) or an empty state is shown —
    // both are valid. Verify the page is in a resolved state (no spinner).
    const resolved = page.locator(
      // payslip cards in grid
      '[class*="rounded-xl"], [class*="card"], [class*="Card"],' +
      // empty state (i18n key payrollMe.emptyMessage)
      ' text=지급된 급여명세서가 없습니다, text=No payslips, [class*="empty"], [class*="Empty"],' +
      // or the wallet empty-state icon wrapper
      ' .text-center',
    ).first()
    await expect(resolved).toBeVisible({ timeout: 10000 })

    // If payslip cards exist, verify they contain key payroll labels
    const payslipCards = page.locator('button[class*="rounded-xl"], div[class*="rounded-xl"]')
    const cardCount = await payslipCards.count()
    if (cardCount > 0) {
      // At least one card contains a net pay label
      const netPayLabel = page.locator('text=실수령액, text=Net Pay, text=netPay').first()
      await expect(netPayLabel).toBeVisible({ timeout: 5000 })
    }
  })

  // ─── RBAC: MANAGER blocked from /payroll ──────────────────

  test('MANAGER is blocked from /payroll admin dashboard', async ({ page }) => {
    await loginAs(page, 'MANAGER')
    await page.goto('/payroll')
    await waitForPageReady(page)

    const currentUrl = page.url()

    // Middleware must redirect away from /payroll
    // Acceptable outcomes: error=forbidden param, redirect to /login, or redirect to /home
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
