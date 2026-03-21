// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Analytics Dashboards E2E Tests
//
// Verifies that all analytics sub-pages load correctly for HR_ADMIN,
// render key UI elements (cards, charts), and do not throw errors.
// Requires:
//   1. Dev server running (npm run dev)
//   2. NEXT_PUBLIC_SHOW_TEST_ACCOUNTS=true in .env
//   3. Seeded test accounts
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { loginAs, assertPageLoads } from './helpers/auth'
import { waitForLoading, waitForPageReady } from './helpers/wait-helpers'

test.describe('Analytics Dashboards', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
  })

  // ─── 1. Executive Dashboard ─────────────────────────────

  test('Executive dashboard loads with summary cards and charts', async ({ page }) => {
    await assertPageLoads(page, '/analytics')
    await waitForPageReady(page)
    await waitForLoading(page)

    // Page heading or main content should be visible
    const main = page.locator('main')
    await expect(main).toBeVisible()

    // At least one card element should render
    const cards = page.locator('[class*="card"], [class*="Card"]')
    await expect(cards.first()).toBeVisible({ timeout: 8000 })

    // Charts rendered by Recharts
    const chart = page.locator('svg.recharts-surface').first()
    const hasChart = await chart.isVisible({ timeout: 5000 }).catch(() => false)
    if (!hasChart) {
      // Fallback: canvas-based charts or generic SVG
      const svg = page.locator('svg').first()
      await expect(svg).toBeVisible({ timeout: 5000 })
    }
  })

  // ─── 2. Workforce Analytics ─────────────────────────────

  test('Workforce analytics page loads with headcount data', async ({ page }) => {
    await assertPageLoads(page, '/analytics/workforce')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Workforce page should contain headcount-related text
    await expect(main).toContainText(/인원|Headcount|workforce/i, { timeout: 8000 })

    // Stat cards or chart surfaces
    const cards = page.locator('[class*="card"], [class*="Card"]')
    await expect(cards.first()).toBeVisible({ timeout: 8000 })
  })

  // ─── 3. Compensation Analytics ──────────────────────────

  test('Compensation analytics page loads with salary data', async ({ page }) => {
    await assertPageLoads(page, '/analytics/compensation')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Compensation page should mention salary or compensation
    await expect(main).toContainText(/급여|보상|Compensation|Salary/i, { timeout: 8000 })

    const cards = page.locator('[class*="card"], [class*="Card"]')
    await expect(cards.first()).toBeVisible({ timeout: 8000 })
  })

  // ─── 4. Payroll Analytics ───────────────────────────────

  test('Payroll analytics page loads with payroll summary', async ({ page }) => {
    await assertPageLoads(page, '/analytics/payroll')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Payroll page should reference payroll content
    await expect(main).toContainText(/급여|Payroll/i, { timeout: 8000 })

    const cards = page.locator('[class*="card"], [class*="Card"]')
    await expect(cards.first()).toBeVisible({ timeout: 8000 })
  })

  // ─── 5. Attendance Analytics ────────────────────────────

  test('Attendance analytics page loads with attendance metrics', async ({ page }) => {
    await assertPageLoads(page, '/analytics/attendance')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Attendance page should reference attendance content
    await expect(main).toContainText(/근태|출결|Attendance/i, { timeout: 8000 })

    const cards = page.locator('[class*="card"], [class*="Card"]')
    await expect(cards.first()).toBeVisible({ timeout: 8000 })
  })

  // ─── 6. Turnover Analytics ──────────────────────────────

  test('Turnover analytics page loads with turnover metrics', async ({ page }) => {
    await assertPageLoads(page, '/analytics/turnover')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Turnover page should reference turnover content
    await expect(main).toContainText(/이직|퇴직|Turnover/i, { timeout: 8000 })

    const cards = page.locator('[class*="card"], [class*="Card"]')
    await expect(cards.first()).toBeVisible({ timeout: 8000 })
  })
})
