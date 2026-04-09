// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compliance E2E Tests
// All compliance pages require HR_ADMIN+.
// ═══════════════════════════════════════════════════════════

import { test } from '@playwright/test'
import { authFile, assertPageLoads } from '../helpers/auth'
import { waitForPageReady } from '../helpers/wait-helpers'

test.describe('Compliance: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('compliance hub loads', async ({ page }) => {
    await assertPageLoads(page, '/compliance')
    await waitForPageReady(page)
  })

  test('data retention page loads', async ({ page }) => {
    await assertPageLoads(page, '/compliance/data-retention')
    await waitForPageReady(page)
  })

  test('PII audit page loads', async ({ page }) => {
    await assertPageLoads(page, '/compliance/pii-audit')
    await waitForPageReady(page)
  })

  test('GDPR page loads', async ({ page }) => {
    await assertPageLoads(page, '/compliance/gdpr')
    await waitForPageReady(page)
  })
})
