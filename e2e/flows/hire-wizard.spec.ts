// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Hire Wizard E2E (N+49 WizardShell SSOT 첫 consumer)
// Covers: Dialog open, step indicator, progress text, validation disabled,
//         step navigation, ESC close, role guard.
// Reference pattern: e2e/flows/employee-crud.spec.ts
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from '../helpers/auth'
import { waitForLoading, waitForPageReady } from '../helpers/wait-helpers'

// ─── HR_ADMIN tests (Dialog opens, navigation works) ─────

test.describe('Hire Wizard: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('WizardShell Dialog opens on /employees/new', async ({ page }) => {
    await assertPageLoads(page, '/employees/new')
    await waitForPageReady(page)
    await waitForLoading(page)

    // Radix Dialog mounted with role="dialog"
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // WizardShell title prop renders DialogTitle (caller passes t('newEmployee'))
    await expect(dialog.getByRole('heading').first()).toBeVisible()
  })

  test('step indicator marks first step as aria-current', async ({ page }) => {
    await page.goto('/employees/new')
    await waitForPageReady(page)
    await waitForLoading(page)

    // 4 step entries rendered as <li> with aria-label "1. ..." through "4. ..."
    const steps = page.locator('li[aria-label^="1."], li[aria-label^="2."], li[aria-label^="3."], li[aria-label^="4."]')
    await expect(steps).toHaveCount(4, { timeout: 10000 })

    // First step is aria-current="step"
    await expect(page.locator('li[aria-current="step"]')).toHaveCount(1)
    await expect(page.locator('li[aria-current="step"]').first()).toHaveAttribute('aria-label', /^1\./)
  })

  test('progress text shows "1 / 4" at first step', async ({ page }) => {
    await page.goto('/employees/new')
    await waitForPageReady(page)
    await waitForLoading(page)

    // WizardShell.tsx L113: progressText(currentStep, steps.length) + t('stepLabel')
    // ko: "1 / 4 단계" (progressText returns "1 / 4", stepLabel = "단계")
    await expect(page.locator('text=/1\\s*\\/\\s*4/').first()).toBeVisible({ timeout: 10000 })
  })

  test('primary button is disabled when step 0 validation fails', async ({ page }) => {
    await page.goto('/employees/new')
    await waitForPageReady(page)
    await waitForLoading(page)

    // canProceed = validateStep(step, data) === null && !submitting
    // Initial data has empty name/email → validateStep returns error → canProceed false → button disabled.
    // The primary button (next/submit role) is the last button in the footer.
    const dialog = page.getByRole('dialog')
    const primary = dialog.getByRole('button').last()
    await expect(primary).toBeDisabled({ timeout: 10000 })
  })

  test('ESC key closes Dialog and navigates to /employees', async ({ page }) => {
    await page.goto('/employees/new')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 })

    // Radix Dialog ESC → onOpenChange(false) → caller onCancel() → router.push('/employees')
    await page.keyboard.press('Escape')

    await expect(async () => {
      expect(page.url()).toContain('/employees')
      expect(page.url()).not.toContain('/employees/new')
    }).toPass({ timeout: 10000 })
  })
})

// ─── EMPLOYEE tests (role guard) ─────────────────────────

test.describe('Hire Wizard: EMPLOYEE (role guard)', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('EMPLOYEE redirected away from /employees/new', async ({ page }) => {
    // page.tsx L27: HR_ADMIN/SUPER_ADMIN only — EMPLOYEE redirected to /employees
    await page.goto('/employees/new')
    await page.waitForLoadState('domcontentloaded')

    await expect(async () => {
      expect(page.url()).not.toContain('/employees/new')
    }).toPass({ timeout: 10000 })
  })
})
