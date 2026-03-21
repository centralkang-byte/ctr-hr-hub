// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance E2E Tests
// Covers employee self-service and HR admin attendance flows
//
// Requires:
//   1. Dev server running (npm run dev)
//   2. NEXT_PUBLIC_SHOW_TEST_ACCOUNTS=true in .env
//   3. Seeded test accounts
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { loginAs, assertPageLoads } from './helpers/auth'
import { waitForLoading, waitForPageReady, waitForTableRows } from './helpers/wait-helpers'

test.describe('Attendance', () => {
  // ─── Employee: Attendance Page Load ──────────────────────

  test('EMPLOYEE can view attendance page', async ({ page }) => {
    await loginAs(page, 'EMPLOYEE')
    await assertPageLoads(page, '/attendance')
    await waitForPageReady(page)
  })

  // ─── Employee: Clock-In Button Visible ───────────────────

  test('EMPLOYEE can see clock-in button', async ({ page }) => {
    await loginAs(page, 'EMPLOYEE')
    await assertPageLoads(page, '/attendance')
    await waitForLoading(page)

    // Clock-in button — Korean "출근" or English "Clock In"
    const clockInButton = page.locator(
      'button:has-text("출근"), button:has-text("Clock In")',
    ).first()
    await expect(clockInButton).toBeVisible({ timeout: 10000 })
  })

  // ─── HR Admin: Attendance Admin Page ─────────────────────

  test('HR_ADMIN can view attendance admin', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/attendance/admin')
    await waitForPageReady(page)

    // Admin page should render a table or data grid with attendance records
    await waitForTableRows(page, 1)
  })

  // ─── HR Admin: Shift Calendar ────────────────────────────

  test('HR_ADMIN can view shift calendar', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/attendance/shift-calendar')
    await waitForPageReady(page)

    // Calendar grid or day cells should be present
    const calendar = page.locator(
      '[class*="calendar"], [class*="Calendar"], [role="grid"], [class*="grid"]',
    ).first()
    await expect(calendar).toBeVisible({ timeout: 10000 })
  })

  // ─── HR Admin: Shift Roster ──────────────────────────────

  test('HR_ADMIN can view shift roster', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/attendance/shift-roster')
    await waitForPageReady(page)

    // Roster renders as a table or list of employee shifts
    const roster = page.locator(
      'table, [role="table"], tbody tr, [class*="roster"], [class*="Roster"]',
    ).first()
    await expect(roster).toBeVisible({ timeout: 10000 })
  })

  // ─── HR Admin: Close Attendance (Payroll) ────────────────

  test('HR_ADMIN can access close-attendance page', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/payroll/close-attendance')
    await waitForLoading(page)

    // Page should show some content — heading, period selector, or summary
    const content = page.locator(
      'h1, h2, text=마감, text=정산, text=Close, text=Attendance, [class*="card"], [class*="Card"]',
    ).first()
    await expect(content).toBeVisible({ timeout: 10000 })
  })
})
