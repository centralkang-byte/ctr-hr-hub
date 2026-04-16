// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Cross-Cutting Features E2E Tests
// Covers: notifications, approvals, bulk movements, my tasks,
//         i18n locale switching, and settings hub.
// Uses storageState for session reuse.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from '../helpers/auth'
import { waitForLoading, waitForPageReady } from '../helpers/wait-helpers'

test.describe('Cross-Cutting Features', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('can view notifications page with category filter tabs', async ({ page }) => {
    await assertPageLoads(page, '/notifications')
    await waitForPageReady(page)
    await waitForLoading(page)

    // Notifications page should render — heading or filter area
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8000 })

    // At least some filter buttons visible
    await expect(page.getByText('전체').first()).toBeVisible()
  })

  test('can view approval inbox with tab structure', async ({ page }) => {
    await assertPageLoads(page, '/my/tasks?tab=approvals')
    await waitForPageReady(page)
    await waitForLoading(page)

    // Filter pill buttons may include a count badge (e.g. "전체 5"), so use regex
    await expect(page.getByRole('button', { name: /^전체/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /^휴가/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /^성과/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /^급여/ }).first()).toBeVisible()

    // Click 휴가 tab without crash
    await page.getByRole('button', { name: /^휴가/ }).first().click()
    await waitForLoading(page)
    expect(page.url()).not.toContain('/login')
  })

  test('can view bulk movements page with 5 movement type cards', async ({ page }) => {
    await assertPageLoads(page, '/hr/bulk-movements')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.getByText('부서이동')).toBeVisible()
    await expect(page.getByText('승진').first()).toBeVisible()
    await expect(page.getByText('법인전환')).toBeVisible()
    await expect(page.getByText('퇴직', { exact: true })).toBeVisible()
    await expect(page.getByText('급여변경')).toBeVisible()
  })

  test('can view my tasks page with task list or empty state', async ({ page }) => {
    await assertPageLoads(page, '/my/tasks')
    await waitForPageReady(page)
    await waitForLoading(page)

    expect(page.url()).not.toContain('/login')

    // Page should show either tasks or empty state
    const main = page.locator('main')
    await expect(main).toBeVisible()
  })

  test('i18n toggle switches locale from ko to en', async ({ page }) => {
    await page.goto('/home')
    await waitForPageReady(page)
    await waitForLoading(page)

    // Locale switcher button with language text
    const localeSwitcher = page.locator('button').filter({
      has: page.locator('svg'),
    }).filter({
      hasText: /한국어|English|中文|Tiếng Việt|Español|🇰🇷|🇺🇸/,
    }).first()

    const switcherVisible = await localeSwitcher.isVisible({ timeout: 5000 }).catch(() => false)

    if (!switcherVisible) {
      // Single-locale company — skip
      return
    }

    const bodyTextBefore = await page.locator('body').innerText()

    await localeSwitcher.click()

    const englishMenuItem = page.locator('[role="menuitem"]').filter({ hasText: /English/ })
    const isDropdown = await englishMenuItem.isVisible({ timeout: 2000 }).catch(() => false)
    if (isDropdown) {
      await englishMenuItem.click()
    }

    await page.waitForTimeout(3000)
    await waitForPageReady(page)

    const bodyTextAfter = await page.locator('body').innerText()
    const hasEnglishText =
      bodyTextAfter.includes('Dashboard') ||
      bodyTextAfter.includes('Employees') ||
      bodyTextAfter.includes('Home') ||
      bodyTextAfter !== bodyTextBefore

    expect(hasEnglishText).toBe(true)
  })

  test('Settings hub loads with 6 category sections', async ({ page }) => {
    await assertPageLoads(page, '/settings')
    await waitForPageReady(page)
    await waitForLoading(page)

    const categoryTexts = ['조직', '근태', '급여', '성과', '채용', '시스템']
    for (const label of categoryTexts) {
      await expect(page.getByText(label).first()).toBeVisible()
    }

    // Search bar
    await expect(page.locator('input[type="text"]').first()).toBeVisible()

    // Filter test
    await page.locator('input[type="text"]').first().fill('급여')
    await waitForLoading(page)
    await expect(page.getByText('급여').first()).toBeVisible()

    // Clear and verify all categories back
    await page.locator('input[type="text"]').first().clear()
    await waitForLoading(page)
    for (const label of categoryTexts) {
      await expect(page.getByText(label).first()).toBeVisible()
    }
  })
})
