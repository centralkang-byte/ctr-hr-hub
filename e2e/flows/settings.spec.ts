// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Settings E2E Tests
// All settings pages require HR_ADMIN+.
// ═══════════════════════════════════════════════════════════

import { test } from '@playwright/test'
import { authFile, assertPageLoads } from '../helpers/auth'
import { waitForPageReady } from '../helpers/wait-helpers'

test.describe('Settings: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('settings hub loads', async ({ page }) => {
    await assertPageLoads(page, '/settings')
    await waitForPageReady(page)
  })

  test('attendance settings loads', async ({ page }) => {
    await assertPageLoads(page, '/settings/attendance')
    await waitForPageReady(page)
  })

  test('organization settings loads', async ({ page }) => {
    await assertPageLoads(page, '/settings/organization')
    await waitForPageReady(page)
  })

  test('payroll settings loads', async ({ page }) => {
    await assertPageLoads(page, '/settings/payroll')
    await waitForPageReady(page)
  })

  test('performance settings loads', async ({ page }) => {
    await assertPageLoads(page, '/settings/performance')
    await waitForPageReady(page)
  })

  test('recruitment settings loads', async ({ page }) => {
    await assertPageLoads(page, '/settings/recruitment')
    await waitForPageReady(page)
  })
})
