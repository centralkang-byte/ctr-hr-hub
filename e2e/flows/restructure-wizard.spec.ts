// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Restructure Wizard E2E (N+50 WizardShell SSOT consumer)
// Covers: trigger→Dialog open, 3-step indicator, progress text,
//         dual-action footer validation, ESC close, role guard.
// Reference pattern: e2e/flows/hire-wizard.spec.ts (N+49)
// ═══════════════════════════════════════════════════════════

import { test, expect, type Page } from '@playwright/test'
import { authFile, assertPageLoads } from '../helpers/auth'
import { waitForLoading, waitForPageReady } from '../helpers/wait-helpers'

// OrgClient: canRestructure(HR_ADMIN/SUPER_ADMIN) → t('restructure')="조직 개편" 버튼이
// setShowRestructureModal(true) → <RestructureModal> = WizardShell consumer (N+50).
async function openWizard(page: Page) {
  await assertPageLoads(page, '/org')
  await waitForPageReady(page)
  await waitForLoading(page)
  await page.getByRole('button', { name: /조직\s*개편/ }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 })
}

// ─── HR_ADMIN tests (Dialog opens, navigation works) ─────

test.describe('Restructure Wizard: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('WizardShell Dialog opens on 조직 개편 trigger', async ({ page }) => {
    await openWizard(page)
    // WizardShell title prop = "조직 개편 계획" → DialogTitle heading
    await expect(
      page.getByRole('dialog').getByRole('heading', { name: /조직 개편 계획/ }).first(),
    ).toBeVisible()
  })

  test('step indicator: 3 steps rendered, first is aria-current', async ({ page }) => {
    await openWizard(page)
    // WIZARD_STEPS = [변경 사항 작성, 영향도 검토, 확인 및 저장] → <li aria-label "1." ~ "3.">
    const steps = page.locator('li[aria-label^="1."], li[aria-label^="2."], li[aria-label^="3."]')
    await expect(steps).toHaveCount(3, { timeout: 10000 })
    await expect(page.locator('li[aria-current="step"]')).toHaveCount(1)
    await expect(page.locator('li[aria-current="step"]').first()).toHaveAttribute('aria-label', /^1\./)
  })

  test('progress text shows "1 / 3" at first step', async ({ page }) => {
    await openWizard(page)
    // WizardShell.tsx: progressText(currentStep, steps.length) → "1 / 3"
    await expect(page.locator('text=/1\\s*\\/\\s*3/').first()).toBeVisible({ timeout: 10000 })
  })

  test('next button disabled until title + change exist', async ({ page }) => {
    await openWizard(page)
    // canProceedToDiff = plan.title.trim() && plan.changes.length > 0 → 초기 false
    const next = page.getByRole('dialog').getByRole('button', { name: /다음.*영향도/ })
    await expect(next).toBeDisabled({ timeout: 10000 })
  })

  test('ESC closes Dialog (onCancel → setShowRestructureModal false)', async ({ page }) => {
    await openWizard(page)
    // Radix Dialog ESC → onOpenChange(false) → WizardShell onCancel = onClose
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 })
  })
})

// ─── EMPLOYEE tests (role guard) ─────────────────────────

test.describe('Restructure Wizard: EMPLOYEE (role guard)', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('EMPLOYEE does not see 조직 개편 trigger', async ({ page }) => {
    await assertPageLoads(page, '/org')
    await waitForPageReady(page)
    await waitForLoading(page)
    // canRestructure = SUPER_ADMIN || HR_ADMIN → EMPLOYEE 비가시
    await expect(page.getByRole('button', { name: /조직\s*개편/ })).toHaveCount(0)
  })
})
