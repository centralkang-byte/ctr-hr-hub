// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Recruitment E2E Tests
// HR_ADMIN access to all recruitment sub-pages.
// Uses storageState for session reuse.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from './helpers/auth'
import { waitForLoading, waitForPageReady } from './helpers/wait-helpers'

test.describe('Recruitment', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('Can view job posting list', async ({ page }) => {
    await assertPageLoads(page, '/recruitment')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 8000 })
    await expect(page.locator('table').first()).toBeVisible({ timeout: 8000 })
    await expect(page.locator('thead').first()).toBeVisible({ timeout: 5000 })

    const newButton = page.locator('button').filter({ hasText: /등록|New|Register/i }).first()
    await expect(newButton).toBeVisible({ timeout: 5000 })
  })

  test('Can access new posting form', async ({ page }) => {
    await assertPageLoads(page, '/recruitment/new')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('form').first()).toBeVisible({ timeout: 8000 })

    const titleInput = page
      .locator('input[name="title"], input[placeholder*="제목"], input[placeholder*="Title"]')
      .first()
    await expect(titleInput).toBeVisible({ timeout: 8000 })
  })

  test('Can view recruitment pipeline kanban board', async ({ page }) => {
    await assertPageLoads(page, '/recruitment/board')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Stage labels: 지원, 서류검토, 면접 etc.
    const stageLabel = page.getByText(/지원|서류검토|1차 면접/).first()
    await expect(stageLabel).toBeVisible({ timeout: 10000 })
  })

  test('Can view applicant list via requisitions', async ({ page }) => {
    await assertPageLoads(page, '/recruitment/requisitions')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8000 })
  })

  test('Can view interview schedule page', async ({ page }) => {
    await assertPageLoads(page, '/recruitment/board')
    await waitForPageReady(page)
    await waitForLoading(page)

    const interviewLabel = page.getByText(/면접|Interview/).first()
    await expect(interviewLabel).toBeVisible({ timeout: 10000 })
  })

  test('Can view recruitment dashboard with stats', async ({ page }) => {
    await assertPageLoads(page, '/recruitment/dashboard')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Dashboard should render heading or stat content (may need extra time to load)
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 })
  })
})
