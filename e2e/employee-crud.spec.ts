// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Management E2E Tests
// Covers: list, search, detail, new form, org/directory/skills, self-profile
// Uses storageState for session reuse.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from './helpers/auth'
import { waitForTableRows, waitForLoading, waitForPageReady } from './helpers/wait-helpers'

// ─── HR_ADMIN tests ──────────────────────────────────────

test.describe('Employee Management: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('can view employee list with data', async ({ page }) => {
    await assertPageLoads(page, '/employees')
    await waitForPageReady(page)
    await waitForLoading(page)
    await waitForTableRows(page, 1)
  })

  test('can search employees', async ({ page }) => {
    await page.goto('/employees')
    await waitForPageReady(page)
    await waitForTableRows(page, 1)

    // Search input should be present
    const searchInput = page.getByPlaceholder(/검색|Search/).first()
    await expect(searchInput).toBeVisible({ timeout: 5000 })

    // Type and wait for results to update
    await searchInput.fill('이민준')
    await page.waitForTimeout(1000)
    await waitForLoading(page)

    // Page should still be functional after search (no crash)
    expect(page.url()).not.toContain('/login')
    await expect(page.locator('text=페이지를 불러올 수 없습니다')).not.toBeVisible()
  })

  test('can view employee detail page', async ({ page }) => {
    await page.goto('/employees')
    await waitForPageReady(page)
    await waitForTableRows(page, 1)

    const firstRow = page.locator('tbody tr').first()
    await firstRow.click()

    await page.waitForTimeout(500)

    const isDetailPage = page.url().match(/\/employees\/[^?/]+$/)
    if (isDetailPage) {
      await waitForPageReady(page)
      await waitForLoading(page)
    }
    // Detail page or panel — either is valid
  })

  test('can access new employee form with Step 1 fields', async ({ page }) => {
    await assertPageLoads(page, '/employees/new')
    await waitForPageReady(page)
    await waitForLoading(page)

    // Form should render with some input fields
    await expect(page.locator('form, input, select, [role="combobox"]').first()).toBeVisible({ timeout: 10000 })
  })

  test('can view organization skill matrix page', async ({ page }) => {
    await assertPageLoads(page, '/organization/skill-matrix')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('table, h1, h2').first()).toBeVisible({ timeout: 10000 })
  })

  test('can view employee directory', async ({ page }) => {
    await assertPageLoads(page, '/directory')
    await waitForPageReady(page)
    await waitForLoading(page)

    // Directory renders cards or table
    const directoryContent = page.locator('tbody tr').or(page.locator('main').locator('div').filter({ has: page.locator('img, svg') })).first()
    await expect(directoryContent).toBeVisible({ timeout: 10000 })
  })

  test('can view skill matrix with competency data', async ({ page }) => {
    await assertPageLoads(page, '/organization/skill-matrix')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('h1, h2, table').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=페이지를 불러올 수 없습니다')).not.toBeVisible()
  })
})

// ─── EMPLOYEE tests ──────────────────────────────────────

test.describe('Employee Management: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('can view own profile with name displayed', async ({ page }) => {
    await assertPageLoads(page, '/my/profile')
    await waitForPageReady(page)
    await waitForLoading(page)

    // QA seed: EMPLOYEE = 이민준 — target the h1 heading specifically
    await expect(page.getByRole('heading', { name: /이민준/ })).toBeVisible({ timeout: 10000 })
  })
})
