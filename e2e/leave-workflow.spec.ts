// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Management E2E Tests
// Uses storageState for session reuse.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from './helpers/auth'
import { waitForLoading, waitForPageReady } from './helpers/wait-helpers'

// ─── EMPLOYEE tests ──────────────────────────────────────

test.describe('Leave: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('can view leave page', async ({ page }) => {
    await assertPageLoads(page, '/leave')
    await waitForPageReady(page)
  })

  test('can see leave page content', async ({ page }) => {
    await assertPageLoads(page, '/leave')
    await waitForLoading(page)

    // Leave page should render main content area
    const main = page.locator('main')
    await expect(main).toBeVisible()
    // Should contain leave-related content (연차, 잔여, balance, etc.)
    await expect(page.locator('h1, h2').or(page.getByText(/연차|잔여|남은|Leave|Balance/)).first()).toBeVisible({ timeout: 10000 })
  })

  test('leave page renders without error', async ({ page }) => {
    await assertPageLoads(page, '/leave')
    await waitForLoading(page)

    // No error boundary
    await expect(page.locator('text=페이지를 불러올 수 없습니다')).not.toBeVisible()
    await expect(page.locator('main')).toBeVisible()
  })
})

// ─── HR_ADMIN tests ──────────────────────────────────────

test.describe('Leave: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('can view leave admin page', async ({ page }) => {
    await assertPageLoads(page, '/leave/admin')
    await waitForPageReady(page)

    const heading = page.locator('h1, h2').or(page.getByText(/휴가 관리|Leave Management/)).first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  test('can view team leave calendar', async ({ page }) => {
    await assertPageLoads(page, '/leave/team')
    await waitForPageReady(page)

    const content = page.locator('[role="grid"]').or(page.locator('table')).or(page.getByText(/팀 휴가|Team Leave/)).first()
    await expect(content).toBeVisible({ timeout: 10000 })
  })

  test('can see leave statistics dashboard', async ({ page }) => {
    await assertPageLoads(page, '/leave/admin')
    await waitForLoading(page)

    // Stats area — heading or main content
    const main = page.locator('main')
    await expect(main).toBeVisible()
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
  })
})

// ─── MANAGER tests ───────────────────────────────────────

test.describe('Leave: MANAGER', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('can view team leave', async ({ page }) => {
    await assertPageLoads(page, '/leave/team')
    await waitForPageReady(page)

    const content = page.locator('[role="grid"]').or(page.locator('table')).or(page.getByText(/팀|Team/)).first()
    await expect(content).toBeVisible({ timeout: 10000 })
  })

  test('can view approval inbox with leave requests', async ({ page }) => {
    await assertPageLoads(page, '/approvals/inbox')
    await waitForLoading(page)

    const inboxContent = page.locator('h1, h2').or(page.getByText(/승인|Approval|Inbox/)).first()
    await expect(inboxContent).toBeVisible({ timeout: 10000 })
  })
})
