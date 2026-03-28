// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance E2E Tests
// Uses storageState for session reuse.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from './helpers/auth'
import { waitForLoading, waitForPageReady, waitForTableRows } from './helpers/wait-helpers'

// ─── EMPLOYEE tests ──────────────────────────────────────

test.describe('Attendance: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('can view attendance page', async ({ page }) => {
    await assertPageLoads(page, '/attendance')
    await waitForPageReady(page)
  })

  test('can see clock-in button', async ({ page }) => {
    await assertPageLoads(page, '/attendance')
    await waitForLoading(page)

    const clockInButton = page.getByRole('button', { name: /출근|Clock In/i }).first()
    await expect(clockInButton).toBeVisible({ timeout: 10000 })
  })
})

// ─── HR_ADMIN tests ──────────────────────────────────────

test.describe('Attendance: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('can view attendance admin', async ({ page }) => {
    await assertPageLoads(page, '/attendance/admin')
    await waitForPageReady(page)
    await waitForTableRows(page, 1)
  })

  test('can view shift calendar', async ({ page }) => {
    await assertPageLoads(page, '/attendance/shift-calendar')
    await waitForPageReady(page)

    const calendar = page.locator('[role="grid"]').or(page.getByText(/월|화|수|목|금/)).first()
    await expect(calendar).toBeVisible({ timeout: 10000 })
  })

  test('can view shift roster', async ({ page }) => {
    await assertPageLoads(page, '/attendance/shift-roster')
    await waitForPageReady(page)

    const roster = page.locator('table, [role="table"], tbody tr').first()
    await expect(roster).toBeVisible({ timeout: 10000 })
  })

  test('can access close-attendance page', async ({ page }) => {
    await assertPageLoads(page, '/payroll/close-attendance')
    await waitForLoading(page)

    const content = page.locator('h1, h2').or(page.getByText(/마감|정산|Close|Attendance/)).first()
    await expect(content).toBeVisible({ timeout: 10000 })
  })
})
