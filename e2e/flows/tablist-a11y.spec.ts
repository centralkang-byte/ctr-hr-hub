// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Tablist arrow-key a11y E2E (N+44)
// Regression guard for useArrowKeyNavigation (roving tabindex), wired into
// the two manual role="tablist" segmented controls:
//   - /my/tasks viewTab (tabTasks | tabApprovals) — gated by canSeeApprovals
//     (role !== EMPLOYEE); ArrowRight also pushes ?tab=approvals
//   - /leave statusFilter (ALL | PENDING | APPROVED | REJECTED | CANCELLED) —
//     rendered for all roles; Arrow/Home/End move aria-selected
// WAI-ARIA: focus follows selection (automatic activation).
// Reference pattern: e2e/flows/hire-wizard.spec.ts (authFile + assertPageLoads)
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from '../helpers/auth'

// ─── HR_ADMIN: viewTab + statusFilter tablists are arrow-navigable ─────

test.describe('Tablist a11y: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('/my/tasks viewTab: arrow keys move aria-selected and update URL', async ({ page }) => {
    await assertPageLoads(page, '/my/tasks')

    const tablist = page.locator('[role="tablist"]')
    await expect(tablist).toBeVisible()

    const tabs = tablist.getByRole('tab')
    await expect(tabs).toHaveCount(2)

    const firstTab = tabs.nth(0) // tasks
    const secondTab = tabs.nth(1) // approvals
    await expect(firstTab).toHaveAttribute('aria-selected', 'true')
    await firstTab.focus()

    // ArrowRight → next tab selected + URL gains ?tab=approvals
    await page.keyboard.press('ArrowRight')
    await expect(secondTab).toHaveAttribute('aria-selected', 'true')
    await expect(firstTab).toHaveAttribute('aria-selected', 'false')
    await expect(page).toHaveURL(/[?&]tab=approvals/)

    // ArrowLeft → back to the first tab
    await page.keyboard.press('ArrowLeft')
    await expect(firstTab).toHaveAttribute('aria-selected', 'true')
    await expect(secondTab).toHaveAttribute('aria-selected', 'false')
  })

  test('/leave statusFilter: Arrow + Home/End move aria-selected', async ({ page }) => {
    await assertPageLoads(page, '/leave')

    const tablist = page.locator('[role="tablist"]')
    await expect(tablist).toBeVisible()

    const tabs = tablist.getByRole('tab')
    await expect(tabs).toHaveCount(5)

    const firstTab = tabs.nth(0) // ALL
    const secondTab = tabs.nth(1) // PENDING
    const lastTab = tabs.nth(4) // CANCELLED
    await expect(firstTab).toHaveAttribute('aria-selected', 'true')
    await firstTab.focus()

    // ArrowRight advances ALL → PENDING
    await page.keyboard.press('ArrowRight')
    await expect(secondTab).toHaveAttribute('aria-selected', 'true')
    await expect(firstTab).toHaveAttribute('aria-selected', 'false')

    // End jumps to the last tab (CANCELLED)
    await page.keyboard.press('End')
    await expect(lastTab).toHaveAttribute('aria-selected', 'true')

    // Home returns to the first tab (ALL)
    await page.keyboard.press('Home')
    await expect(firstTab).toHaveAttribute('aria-selected', 'true')
  })
})

// ─── EMPLOYEE: viewTab tablist is gated out (canSeeApprovals === false) ─────

test.describe('Tablist a11y: EMPLOYEE (no approvals view)', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('/my/tasks viewTab tablist is not rendered for EMPLOYEE', async ({ page }) => {
    await assertPageLoads(page, '/my/tasks')
    // Let the client view settle, then assert the gated tablist is absent.
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[role="tablist"]')).toHaveCount(0)
  })
})
