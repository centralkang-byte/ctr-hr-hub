// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Management E2E Tests
// Covers employee self-service, HR admin, and manager flows
//
// Requires:
//   1. Dev server running (npm run dev)
//   2. NEXT_PUBLIC_SHOW_TEST_ACCOUNTS=true in .env
//   3. Seeded test accounts
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { loginAs, assertPageLoads } from './helpers/auth'
import { waitForLoading, waitForPageReady, waitForToast } from './helpers/wait-helpers'

test.describe('Leave Management', () => {
  // ─── Employee: Leave Page Load ────────────────────────────

  test('EMPLOYEE can view leave page', async ({ page }) => {
    await loginAs(page, 'EMPLOYEE')
    await assertPageLoads(page, '/leave')
    await waitForPageReady(page)
  })

  // ─── Employee: Leave Balance Cards ───────────────────────

  test('EMPLOYEE can see leave balance cards', async ({ page }) => {
    await loginAs(page, 'EMPLOYEE')
    await assertPageLoads(page, '/leave')
    await waitForLoading(page)

    // Balance section should be visible — contains 연차 (annual leave) label
    const balanceSection = page.locator(
      'text=연차, text=잔여, text=남은, [class*="balance"], [class*="Balance"]',
    ).first()

    // Try common balance card patterns: card with 연차 or a numeric balance display
    const annualLeaveText = page.locator('text=연차').first()
    await expect(annualLeaveText).toBeVisible({ timeout: 10000 })
  })

  // ─── Employee: Open Leave Request Dialog ─────────────────

  test('EMPLOYEE can open leave request dialog', async ({ page }) => {
    await loginAs(page, 'EMPLOYEE')
    await assertPageLoads(page, '/leave')
    await waitForLoading(page)

    // Click the leave request button (휴가 신청 or similar)
    const requestButton = page.locator(
      'button:has-text("휴가 신청"), button:has-text("신청"), button:has-text("Request Leave")',
    ).first()
    await expect(requestButton).toBeVisible({ timeout: 10000 })
    await requestButton.click()

    // Dialog or Sheet should appear
    const dialog = page.locator('[role="dialog"]').first()
    await expect(dialog).toBeVisible({ timeout: 5000 })
  })

  // ─── HR Admin: Leave Admin Page ──────────────────────────

  test('HR_ADMIN can view leave admin page', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/leave/admin')
    await waitForPageReady(page)

    // Admin page should render some content — heading or stat cards
    const heading = page.locator(
      'h1, h2, [class*="heading"], text=휴가 관리, text=Leave Management',
    ).first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  // ─── HR Admin: Team Leave Calendar ───────────────────────

  test('HR_ADMIN can view team leave calendar', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/leave/team')
    await waitForPageReady(page)

    // Calendar or team leave list should render
    const calendarOrList = page.locator(
      '[class*="calendar"], [class*="Calendar"], table, [role="grid"], text=팀 휴가, text=Team Leave',
    ).first()
    await expect(calendarOrList).toBeVisible({ timeout: 10000 })
  })

  // ─── HR Admin: Leave Statistics Dashboard ────────────────

  test('HR_ADMIN can see leave statistics dashboard', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/leave/admin')
    await waitForLoading(page)

    // Stats cards should be visible — look for Card elements or numeric stat displays
    // Common stat card patterns in the codebase use shadcn Card
    const statsArea = page.locator(
      '[class*="card"], [class*="Card"], [class*="stat"], [class*="Stat"]',
    ).first()
    await expect(statsArea).toBeVisible({ timeout: 10000 })
  })

  // ─── Manager: Team Leave Page ─────────────────────────────

  test('MANAGER can view team leave', async ({ page }) => {
    await loginAs(page, 'MANAGER')
    await assertPageLoads(page, '/leave/team')
    await waitForPageReady(page)

    // Team leave content should render — calendar, table, or list
    const content = page.locator(
      '[class*="calendar"], [class*="Calendar"], table, [role="grid"], text=팀, text=Team',
    ).first()
    await expect(content).toBeVisible({ timeout: 10000 })
  })

  // ─── Manager: Approval Inbox with Leave Requests ─────────

  test('MANAGER can view approval inbox with leave requests', async ({ page }) => {
    await loginAs(page, 'MANAGER')
    await assertPageLoads(page, '/approvals/inbox')
    await waitForLoading(page)

    // Inbox page should render — heading or table present
    const inboxContent = page.locator(
      'h1, h2, text=승인, text=Approval, text=Inbox, table, [role="table"]',
    ).first()
    await expect(inboxContent).toBeVisible({ timeout: 10000 })
  })
})
