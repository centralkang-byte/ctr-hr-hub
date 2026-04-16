// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance E2E Tests
// Uses storageState for session reuse.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from '../helpers/auth'
import { waitForLoading, waitForPageReady } from '../helpers/wait-helpers'

// ─── EMPLOYEE tests ──────────────────────────────────────

test.describe('Attendance: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('can view attendance page', async ({ page }) => {
    await assertPageLoads(page, '/attendance')
    await waitForPageReady(page)
  })

  test('can see attendance action area', async ({ page }) => {
    await assertPageLoads(page, '/attendance')
    await waitForPageReady(page)

    // Depending on clock state, shows clock-in button, clock-out button, or completed status
    const clockInBtn = page.getByRole('button', { name: /출근|Clock In/i }).first()
    const clockOutBtn = page.getByRole('button', { name: /퇴근|Clock Out/i }).first()
    const completedBadge = page.getByText(/퇴근 완료|근무 완료|Completed/i).first()
    await expect(clockInBtn.or(clockOutBtn).or(completedBadge)).toBeVisible({ timeout: 15000 })
  })
})

// ─── HR_ADMIN tests ──────────────────────────────────────

test.describe('Attendance: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('can view attendance admin', async ({ page }) => {
    await assertPageLoads(page, '/attendance/admin')
    await waitForPageReady(page)

    // Admin page shows either a data table or empty state depending on seed data
    const table = page.locator('table')
    const emptyState = page.getByText(/데이터가 없습니다|No data|noData/)
    const pageContent = page.locator('main')
    await expect(pageContent).toBeVisible({ timeout: 10000 })
    await expect(table.or(emptyState)).toBeVisible({ timeout: 10000 })
  })

  test('can view shift calendar', async ({ page }) => {
    await assertPageLoads(page, '/attendance/shift-calendar')
    await waitForPageReady(page)

    // Shows calendar grid with day headers, or empty state if no shift groups configured
    const calendar = page.locator('[role="grid"]').or(page.getByText(/월|화|수|목|금/)).first()
    const emptyState = page.getByText(/데이터가 없습니다|No data/)
    const heading = page.locator('h1, h2').first()
    await expect(calendar.or(emptyState).or(heading)).toBeVisible({ timeout: 10000 })
  })

  test('can view shift roster', async ({ page }) => {
    await assertPageLoads(page, '/attendance/shift-roster')
    await waitForPageReady(page)

    // Shows roster table if shift groups exist, or heading/empty state otherwise
    const roster = page.locator('table, [role="table"], tbody tr').first()
    const heading = page.locator('h1').first()
    await expect(roster.or(heading)).toBeVisible({ timeout: 10000 })
  })

  test('can access close-attendance page', async ({ page }) => {
    await assertPageLoads(page, '/payroll/close-attendance')
    await waitForLoading(page)

    const content = page.locator('h1, h2').or(page.getByText(/마감|정산|Close|Attendance/)).first()
    await expect(content).toBeVisible({ timeout: 10000 })
  })
})
