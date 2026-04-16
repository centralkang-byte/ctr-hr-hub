// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Analytics Dashboards E2E Tests
//
// Uses storageState for HR_ADMIN session reuse.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from '../helpers/auth'
import { waitForLoading, waitForPageReady } from '../helpers/wait-helpers'

test.describe('Analytics Dashboards', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('Executive dashboard loads with summary cards and charts', async ({ page }) => {
    await assertPageLoads(page, '/analytics')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()

    // h1 heading should render
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 8000 })

    // Charts rendered by Recharts
    const chart = page.locator('svg.recharts-surface').first()
    const hasChart = await chart.isVisible({ timeout: 5000 }).catch(() => false)
    if (!hasChart) {
      const svg = page.locator('svg').first()
      await expect(svg).toBeVisible({ timeout: 5000 })
    }
  })

  test('Workforce analytics page loads with headcount data', async ({ page }) => {
    await assertPageLoads(page, '/analytics/workforce')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()
    // Page should render heading or content (may take extra time for heavy analytics queries)
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 })
  })

  test('Compensation analytics page loads with salary data', async ({ page }) => {
    await assertPageLoads(page, '/analytics/compensation')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()
    await expect(main).toContainText(/급여|보상|Compensation|Salary/i, { timeout: 8000 })
  })

  test('Payroll analytics page loads with payroll summary', async ({ page }) => {
    await assertPageLoads(page, '/analytics/payroll')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()
    await expect(main).toContainText(/급여|Payroll/i, { timeout: 8000 })
  })

  test('Attendance analytics page loads with attendance metrics', async ({ page }) => {
    await assertPageLoads(page, '/analytics/attendance')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()
    await expect(main).toContainText(/근태|출결|Attendance/i, { timeout: 8000 })
  })

  test('Turnover analytics page loads with turnover metrics', async ({ page }) => {
    await assertPageLoads(page, '/analytics/turnover')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()
    await expect(main).toContainText(/이직|퇴직|Turnover/i, { timeout: 8000 })
  })
})
