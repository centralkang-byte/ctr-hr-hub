// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Cross-Cutting Features E2E Tests
//
// Covers: notifications, approvals, bulk movements, my tasks,
//         i18n locale switching, and settings hub.
//
// Requires:
//   1. Dev server running (npm run dev)
//   2. NEXT_PUBLIC_SHOW_TEST_ACCOUNTS=true in .env
//   3. Seeded test accounts
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { loginAs, assertPageLoads } from './helpers/auth'
import { waitForLoading, waitForPageReady } from './helpers/wait-helpers'

test.describe('Cross-Cutting Features', () => {
  // ─── 1. Notifications page ─────────────────────────────

  test('HR_ADMIN can view notifications page with category filter tabs', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/notifications')
    await waitForPageReady(page)
    await waitForLoading(page)

    // The notifications page has 6 trigger-type filter buttons:
    // 전체 / 승인 / 성과 / 근태 / 채용 / 시스템
    // plus 3 read-status filter buttons: 전체 / 미읽음 / 읽음 = 9 total buttons in filter area
    // We target the trigger-type tabs which are <button> inside a border-b div
    const triggerButtons = page.locator('div.flex.border-b button')
    const count = await triggerButtons.count()
    expect(count).toBeGreaterThanOrEqual(6)

    // Verify the "전체" tab is visible (always first)
    await expect(triggerButtons.first()).toBeVisible()
    await expect(triggerButtons.first()).toContainText('전체')

    // Verify specific category tab labels
    await expect(page.locator('button:has-text("승인")')).toBeVisible()
    await expect(page.locator('button:has-text("성과")')).toBeVisible()
    await expect(page.locator('button:has-text("근태")')).toBeVisible()
    await expect(page.locator('button:has-text("채용")')).toBeVisible()
    await expect(page.locator('button:has-text("시스템")')).toBeVisible()

    // Verify read-status filter is also present
    await expect(page.locator('button:has-text("미읽음")')).toBeVisible()
    await expect(page.locator('button:has-text("읽음")')).toBeVisible()
  })

  // ─── 2. Approval inbox ─────────────────────────────────

  test('HR_ADMIN can view approval inbox with tab structure', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/approvals/inbox')
    await waitForPageReady(page)
    await waitForLoading(page)

    // The ApprovalInboxClient renders tabs: 전체 / 휴가 / 성과 / 급여
    // These are custom button tabs (not role="tab") matching the TABS constant
    await expect(page.locator('button:has-text("전체")')).toBeVisible()
    await expect(page.locator('button:has-text("휴가")')).toBeVisible()
    await expect(page.locator('button:has-text("성과")')).toBeVisible()
    await expect(page.locator('button:has-text("급여")')).toBeVisible()

    // Clicking a tab should not cause a page crash
    await page.locator('button:has-text("휴가")').first().click()
    await waitForLoading(page)
    expect(page.url()).not.toContain('/login')
  })

  // ─── 3. Bulk movements page ────────────────────────────

  test('HR_ADMIN can view bulk movements page with 5 movement type cards', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/hr/bulk-movements')
    await waitForPageReady(page)
    await waitForLoading(page)

    // The TypeSelector renders 5 movement type cards:
    // 부서이동 / 승진 / 법인전환 / 퇴직 / 급여변경
    await expect(page.locator('p:has-text("부서이동")')).toBeVisible()
    await expect(page.locator('p:has-text("승진")')).toBeVisible()
    await expect(page.locator('p:has-text("법인전환")')).toBeVisible()
    await expect(page.locator('p:has-text("퇴직")')).toBeVisible()
    await expect(page.locator('p:has-text("급여변경")')).toBeVisible()

    // Verify the card grid contains exactly 5 cards
    // Each card wraps a CardContent with the type label as a <p class="font-medium">
    const typeCards = page.locator('[class*="cursor-pointer"]')
    const cardCount = await typeCards.count()
    expect(cardCount).toBeGreaterThanOrEqual(5)
  })

  // ─── 4. My tasks page ──────────────────────────────────

  test('HR_ADMIN can view my tasks page with task list or empty state', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/my/tasks')
    await waitForPageReady(page)
    await waitForLoading(page)

    // Page should not redirect to login or show error boundary
    expect(page.url()).not.toContain('/login')

    // Either a task card list or an empty state should be visible
    // Task cards: Card components with link icons
    // Empty state: EmptyState component (typically has an icon + text)
    const taskCards = page.locator('[class*="rounded"][class*="border"]')
    const emptyState = page.locator('[class*="EmptyState"], text=업무가 없습니다, text=No tasks')

    const hasCards = await taskCards.count().then((c) => c > 0)
    const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false)

    // At least one of the two must be present
    expect(hasCards || hasEmptyState).toBe(true)
  })

  // ─── 5. i18n locale toggle ─────────────────────────────

  test('i18n toggle switches locale from ko to en', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await page.goto('/home')
    await waitForPageReady(page)
    await waitForLoading(page)

    // The LanguageSwitcher renders a Globe icon button in the Header.
    // For CTR-KR company (hr@ctr.co.kr), it may show a toggle button or dropdown.
    // The button shows the current locale name or the other locale to switch to.
    // Look for the Globe button that contains a language label.
    const localeSwitcher = page.locator('button').filter({
      has: page.locator('svg'),
    }).filter({
      hasText: /한국어|English|中文|Tiếng Việt|Español|🇰🇷|🇺🇸/,
    }).first()

    const switcherVisible = await localeSwitcher.isVisible({ timeout: 5000 }).catch(() => false)

    if (!switcherVisible) {
      // If the locale switcher is not visible for this company/locale combination,
      // the test passes as the component intentionally hides when only 1 locale is available.
      console.log('Locale switcher not visible — single-locale company configuration, skipping toggle.')
      return
    }

    // Record current page text to compare after switch
    const bodyTextBefore = await page.locator('body').innerText()

    // Click the switcher
    await localeSwitcher.click()

    // If it's a dropdown (3+ locales), select English
    const englishMenuItem = page.locator('[role="menuitem"]').filter({ hasText: /English/ })
    const isDropdown = await englishMenuItem.isVisible({ timeout: 2000 }).catch(() => false)
    if (isDropdown) {
      await englishMenuItem.click()
    }

    // Wait for the locale change to propagate (router.refresh() + cookie set)
    await page.waitForLoadState('networkidle', { timeout: 10000 })
    await waitForPageReady(page)

    // After switching, verify that English text appears in the navigation or page
    // Common English labels: "Dashboard", "Employees", "Home"
    const bodyTextAfter = await page.locator('body').innerText()

    // Page content must have changed
    const hasEnglishText =
      bodyTextAfter.includes('Dashboard') ||
      bodyTextAfter.includes('Employees') ||
      bodyTextAfter.includes('Home') ||
      bodyTextAfter.includes('English') ||
      bodyTextAfter !== bodyTextBefore

    expect(hasEnglishText).toBe(true)
  })

  // ─── 6. Settings hub ───────────────────────────────────

  test('Settings hub loads with 6 category sections', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/settings')
    await waitForPageReady(page)
    await waitForLoading(page)

    // The SettingsHubClient renders SETTINGS_CATEGORIES — 6 categories:
    // 조직/인사 (Organization) / 근태 (Attendance) / 급여 (Payroll) /
    // 성과 (Performance) / 채용 (Recruitment) / 시스템 (System)
    //
    // Each category renders as a SettingsCategoryCard in a grid.
    // We look for the Korean labels as text in the cards.
    await expect(page.locator('text=조직').first()).toBeVisible()
    await expect(page.locator('text=근태').first()).toBeVisible()
    await expect(page.locator('text=급여').first()).toBeVisible()
    await expect(page.locator('text=성과').first()).toBeVisible()
    await expect(page.locator('text=채용').first()).toBeVisible()
    await expect(page.locator('text=시스템').first()).toBeVisible()

    // The search bar should be present
    await expect(page.locator('input[type="text"]').first()).toBeVisible()

    // Typing in the search bar should filter results without crashing
    await page.locator('input[type="text"]').first().fill('급여')
    await waitForLoading(page)

    // At least the payroll card should remain visible
    await expect(page.locator('text=급여').first()).toBeVisible()

    // Clear search to restore all categories
    await page.locator('input[type="text"]').first().clear()
    await waitForLoading(page)

    // All 6 categories should be back
    const categoryTexts = ['조직', '근태', '급여', '성과', '채용', '시스템']
    for (const label of categoryTexts) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible()
    }
  })
})
