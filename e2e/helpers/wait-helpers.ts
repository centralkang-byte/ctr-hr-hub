// ═══════════════════════════════════════════════════════════
// CTR HR Hub — E2E Wait Helpers
// Async operation helpers for state transitions and data loading
// ═══════════════════════════════════════════════════════════

import { type Page, expect } from '@playwright/test'

/**
 * Wait for a toast message to appear (shadcn/ui Sonner toast).
 */
export async function waitForToast(page: Page, text: string | RegExp, timeout = 5000) {
  const toast = page.locator('[data-sonner-toast]', { hasText: text })
  await expect(toast).toBeVisible({ timeout })
  return toast
}

/**
 * Wait for loading spinner to disappear.
 */
export async function waitForLoading(page: Page, timeout = 10000) {
  const spinner = page.locator('.animate-spin').first()
  if (await spinner.isVisible({ timeout: 1000 }).catch(() => false)) {
    await expect(spinner).not.toBeVisible({ timeout })
  }
}

/**
 * Wait for a DataTable to render rows.
 */
export async function waitForTableRows(page: Page, minRows = 1, timeout = 10000) {
  const rows = page.locator('tbody tr')
  await expect(rows.first()).toBeVisible({ timeout })
  const count = await rows.count()
  expect(count).toBeGreaterThanOrEqual(minRows)
  return count
}

/**
 * Wait for page content to stabilize after navigation.
 * More reliable than networkidle for SPA transitions.
 */
export async function waitForPageReady(page: Page, timeout = 10000) {
  await page.waitForLoadState('domcontentloaded', { timeout })
  // Wait for any skeleton loaders to disappear
  const skeleton = page.locator('[class*="skeleton"], [class*="Skeleton"]').first()
  if (await skeleton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await expect(skeleton).not.toBeVisible({ timeout })
  }
}

/**
 * Assert no console errors during a test block.
 * Call at the start of a test to begin collecting.
 */
export function collectConsoleErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })
  return errors
}
