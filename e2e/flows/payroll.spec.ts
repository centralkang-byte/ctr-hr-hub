// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll E2E Tests
// Covers payroll admin pages (HR_ADMIN) and self-service (EMPLOYEE).
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from '../helpers/auth'
import { waitForLoading, waitForPageReady } from '../helpers/wait-helpers'

// ─── HR_ADMIN tests ─────────────────────────────────────

test.describe('Payroll: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('payroll dashboard loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll')
    await waitForPageReady(page)
  })

  test('payroll run list renders table', async ({ page }) => {
    await assertPageLoads(page, '/payroll')
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
  })

  test('close attendance page loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll/close-attendance')
    await waitForPageReady(page)
  })

  test('adjustments page loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll/adjustments')
    await waitForPageReady(page)
  })

  test('anomalies page loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll/anomalies')
    await waitForPageReady(page)
  })

  test('simulation page loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll/simulation')
    await waitForPageReady(page)
  })

  test('bank transfers page loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll/bank-transfers')
    await waitForPageReady(page)
  })

  test('year-end page loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll/year-end')
    await waitForPageReady(page)
  })

  test('global payroll page loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll/global')
    await waitForPageReady(page)
  })

  test('import page loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll/import')
    await waitForPageReady(page)
  })
})

// ─── EMPLOYEE tests ─────────────────────────────────────

test.describe('Payroll: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('my payslip page loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll/me')
    await waitForPageReady(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()
  })
})
