// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Onboarding & Offboarding E2E Tests
// Uses storageState for session reuse.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from './helpers/auth'
import { waitForLoading, waitForPageReady } from './helpers/wait-helpers'

// ─── HR_ADMIN tests ──────────────────────────────────────

test.describe('Onboarding: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('can view onboarding dashboard', async ({ page }) => {
    await assertPageLoads(page, '/onboarding')
    await waitForPageReady(page)

    await expect(page.getByRole('button', { name: '전체' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: '온보딩' })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: '오프보딩' })).toBeVisible({ timeout: 5000 })
  })

  test('can view offboarding cases', async ({ page }) => {
    await assertPageLoads(page, '/offboarding', { timeout: 60000 })
    await waitForLoading(page)

    // Tab or table
    const tabOrTable = page.locator('[role="tab"]').or(page.locator('table')).first()
    await expect(tabOrTable).toBeVisible({ timeout: 15000 })

    // D-day or status text
    const statusText = page.getByText(/D-|진행중|완료|퇴직/).first()
    await expect(statusText).toBeVisible({ timeout: 10000 })
  })

  test('onboarding dashboard shows 5 plan-type tabs', async ({ page }) => {
    await assertPageLoads(page, '/onboarding')
    await waitForPageReady(page)

    const expectedLabels = ['전체', '온보딩', '오프보딩', '크로스보딩 출발', '크로스보딩 도착']
    for (const label of expectedLabels) {
      await expect(page.getByRole('button', { name: label }).first()).toBeVisible({ timeout: 10000 })
    }

    // Tab click works
    await page.getByRole('button', { name: '온보딩' }).first().click()
    await waitForLoading(page)
  })
})

// ─── EMPLOYEE tests ──────────────────────────────────────

test.describe('Onboarding: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('can access my onboarding page', async ({ page }) => {
    await assertPageLoads(page, '/onboarding/me')
    await waitForPageReady(page)

    const content = page.locator('h1, h2').or(page.getByText(/온보딩|진행/)).first()
    await expect(content).toBeVisible({ timeout: 10000 })
  })
})
