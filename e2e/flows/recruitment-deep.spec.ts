// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Recruitment Deep E2E Tests
// Supplements existing recruitment.spec.ts with uncovered pages.
// Recruitment is HR_UP only (middleware).
// ═══════════════════════════════════════════════════════════

import { test } from '@playwright/test'
import { authFile, assertPageLoads } from '../helpers/auth'
import { waitForPageReady } from '../helpers/wait-helpers'

test.describe('Recruitment Deep: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('recruitment requisitions loads', async ({ page }) => {
    await assertPageLoads(page, '/recruitment/requisitions')
    await waitForPageReady(page)
  })

  test('recruitment cost analysis loads', async ({ page }) => {
    await assertPageLoads(page, '/recruitment/cost-analysis')
    await waitForPageReady(page)
  })
})
