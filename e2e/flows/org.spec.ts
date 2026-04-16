// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Org Chart & Skill Matrix E2E Tests
// /org is ALL_ROLES accessible (read-only for non-HR).
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from '../helpers/auth'
import { waitForLoading, waitForPageReady } from '../helpers/wait-helpers'

// ─── HR_ADMIN tests ─────────────────────────────────────

test.describe('Org: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('org chart page loads', async ({ page }) => {
    await assertPageLoads(page, '/org')
    await waitForPageReady(page)
  })

  test('org chart renders tree content', async ({ page }) => {
    await assertPageLoads(page, '/org')
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()
    // OrgClient is dynamically imported (ssr: false) — h1 appears after chunk load + API fetch
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 30000 })
  })

  test('skill matrix page loads', async ({ page }) => {
    await assertPageLoads(page, '/organization/skill-matrix')
    await waitForPageReady(page)
  })
})

// ─── EMPLOYEE tests (read-only access) ──────────────────

test.describe('Org: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  // Codex MED: /org is ALL_ROLES accessible — loads read-only, not blocked
  test('org chart loads read-only', async ({ page }) => {
    await assertPageLoads(page, '/org')

    const main = page.locator('main')
    await expect(main).toBeVisible()
    // OrgClient is dynamically imported — wait for content to appear
    await waitForLoading(page)
  })
})
