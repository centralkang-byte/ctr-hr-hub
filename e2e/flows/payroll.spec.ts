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
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15000 })
  })

  // Wave 1: 새 사이클 생성 폼 = WdDrawer (입력 폼 표준). 제출 없이 open→cancel만
  // 검증 — 공유 시드에 run을 만들지 않는다 (@@unique 충돌·시드 오염 방지).
  test('create run drawer opens and cancels without submit', async ({ page }) => {
    await assertPageLoads(page, '/payroll')
    await waitForLoading(page)

    await page.getByRole('button', { name: /새 사이클|New cycle/ }).click()
    const drawer = page.getByRole('dialog')
    await expect(drawer.getByText(/급여 실행 생성|Create Payroll Run/).first()).toBeVisible()
    await expect(drawer.locator('#payroll-create-yearMonth')).toBeVisible()
    await expect(drawer.locator('#payroll-create-payDate')).toBeVisible()

    await drawer.getByRole('button', { name: /취소|Cancel/ }).click()
    await expect(drawer).toBeHidden()
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
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()
    // h1 appears after API fetch completes (loading → content or empty state)
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15000 })
  })
})
