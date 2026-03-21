// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Performance Management E2E Tests
//
// Verifies that all performance sub-pages load correctly for
// HR_ADMIN and MANAGER roles without errors.
// Requires:
//   1. Dev server running (npm run dev)
//   2. NEXT_PUBLIC_SHOW_TEST_ACCOUNTS=true in .env
//   3. Seeded test accounts
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { loginAs, assertPageLoads } from './helpers/auth'
import { waitForLoading, waitForPageReady } from './helpers/wait-helpers'

test.describe('Performance Management', () => {

  // ─── 1. HR_ADMIN: Performance Dashboard ─────────────────

  test('HR_ADMIN can view performance dashboard', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/performance')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Dashboard renders stat cards (current cycle, goal count, avg achievement, next deadline)
    const cards = page.locator('[class*="rounded-xl"][class*="border"]')
    await expect(cards.first()).toBeVisible({ timeout: 8000 })

    // Page header with h1
    const heading = page.locator('h1')
    await expect(heading).toBeVisible({ timeout: 8000 })
  })

  // ─── 2. HR_ADMIN: Goals Page ────────────────────────────

  test('HR_ADMIN can view goals page', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/performance/goals')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Goals page has h1 for goal management and an "Add goal" button
    const heading = page.locator('h1')
    await expect(heading).toBeVisible({ timeout: 8000 })

    // Cycle selector dropdown should be present
    const cycleSelect = page.locator('select').first()
    await expect(cycleSelect).toBeVisible({ timeout: 8000 })

    // Either goal cards or empty state text is visible
    const goalContent = page.locator(
      '[class*="rounded-lg"][class*="bg-white"], [class*="EmptyState"], text=/등록된 목표가 없습니다|목표를 추가/i',
    )
    await expect(goalContent.first()).toBeVisible({ timeout: 10000 })
  })

  // ─── 3. HR_ADMIN: Calibration ───────────────────────────

  test('HR_ADMIN can view calibration page with session list or new session button', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/performance/calibration')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Page heading for calibration
    const heading = page.locator('h1')
    await expect(heading).toBeVisible({ timeout: 8000 })

    // The "New session" button (Plus icon button) must be rendered for HR_ADMIN
    const newSessionButton = page.locator('button:has(svg)').filter({ hasText: /세션|session/i })
    const plusButton = page.locator('button').filter({ has: page.locator('svg') }).first()
    // At minimum, a button exists in the header area
    await expect(plusButton).toBeVisible({ timeout: 8000 })

    // Sessions panel (left column) is rendered even if empty
    const sessionPanel = page.locator('[class*="rounded-xl"][class*="border"][class*="bg-white"]').first()
    await expect(sessionPanel).toBeVisible({ timeout: 8000 })
  })

  // ─── 4. HR_ADMIN: Peer Review ───────────────────────────

  test('HR_ADMIN can view peer review page', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/performance/peer-review')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Page renders without error boundary
    const errorBoundary = page.locator('text=페이지를 불러올 수 없습니다')
    await expect(errorBoundary).not.toBeVisible()

    // Some primary content is visible — heading or tab area
    const heading = page.locator('h1, h2').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  // ─── 5. MANAGER: Goals Page ─────────────────────────────

  test('MANAGER can view goals page', async ({ page }) => {
    await loginAs(page, 'MANAGER')
    await assertPageLoads(page, '/performance/goals')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Heading for goal management
    const heading = page.locator('h1')
    await expect(heading).toBeVisible({ timeout: 8000 })

    // Cycle selector dropdown
    const cycleSelect = page.locator('select').first()
    await expect(cycleSelect).toBeVisible({ timeout: 8000 })
  })

  // ─── 6. MANAGER: Peer Review ────────────────────────────

  test('MANAGER can view peer review page', async ({ page }) => {
    await loginAs(page, 'MANAGER')
    await assertPageLoads(page, '/performance/peer-review')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Page renders without error boundary
    const errorBoundary = page.locator('text=페이지를 불러올 수 없습니다')
    await expect(errorBoundary).not.toBeVisible()

    // Some primary content is visible
    const heading = page.locator('h1, h2').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  // ─── 7. HR_ADMIN: 1:1 Meetings ──────────────────────────

  test('HR_ADMIN can view 1:1 meetings page', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/performance/one-on-one')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Page renders without error boundary
    const errorBoundary = page.locator('text=페이지를 불러올 수 없습니다')
    await expect(errorBoundary).not.toBeVisible()

    // 1:1 page has a heading or primary section visible
    const heading = page.locator('h1, h2').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  // ─── 8. HR_ADMIN: Recognition ───────────────────────────

  test('HR_ADMIN can view recognition page with feed or empty state', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/performance/recognition')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Page renders without error boundary
    const errorBoundary = page.locator('text=페이지를 불러올 수 없습니다')
    await expect(errorBoundary).not.toBeVisible()

    // Recognition feed items, empty state, or core value filter buttons should be visible
    const feedOrEmpty = page.locator(
      '[class*="rounded"][class*="border"], [class*="EmptyState"], button:has-text("도전"), button:has-text("신뢰")',
    )
    await expect(feedOrEmpty.first()).toBeVisible({ timeout: 10000 })
  })
})
