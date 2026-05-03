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

    const main = page.locator('main')
    await expect(main).toBeVisible({ timeout: 10000 })
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  test('can view shift calendar', async ({ page }) => {
    await assertPageLoads(page, '/attendance/shift-calendar')
    await waitForPageReady(page)

    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  test('can view shift roster', async ({ page }) => {
    await assertPageLoads(page, '/attendance/shift-roster')
    await waitForPageReady(page)

    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  test('can access close-attendance page', async ({ page }) => {
    await assertPageLoads(page, '/payroll/close-attendance')
    await waitForLoading(page)

    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })
})
