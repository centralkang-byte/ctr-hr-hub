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
 * Excludes permanent spinners (e.g., refresh icons with animate-spin class).
 */
export async function waitForLoading(page: Page, timeout = 10000) {
  // Target loading spinners: div-based spinners AND SVG icon spinners (Loader2)
  const spinner = page.locator('.animate-spin, [data-loading="true"]').first()
  if (await spinner.isVisible({ timeout: 2000 }).catch(() => false)) {
    await expect(spinner).not.toBeVisible({ timeout })
  }
}

/**
 * Wait for a DataTable to render rows.
 * Uses expect.toPass() for retry resilience.
 */
export async function waitForTableRows(page: Page, minRows = 1, timeout = 15000) {
  // Wait for table element first
  await expect(page.locator('table')).toBeVisible({ timeout })

  // Then wait for rows with retry
  await expect(async () => {
    const count = await page.locator('tbody tr').count()
    expect(count).toBeGreaterThanOrEqual(minRows)
  }).toPass({ timeout })

  return await page.locator('tbody tr').count()
}

/**
 * Wait for page content to stabilize after navigation.
 * Handles skeleton loaders AND spinners.
 */
export async function waitForPageReady(page: Page, timeout = 15000) {
  await page.waitForLoadState('domcontentloaded', { timeout })

  // Wait for skeleton loaders to disappear
  // shadcn Skeleton uses animate-pulse class (not "skeleton" in classname)
  // PageSkeleton composites also use Skeleton which renders animate-pulse divs
  const skeleton = page.locator('.animate-pulse').first()
  if (await skeleton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await expect(skeleton).not.toBeVisible({ timeout })
  }

  // Wait for spinners (SVG icons like Loader2 and div-based spinners)
  const spinner = page.locator('.animate-spin').first()
  if (await spinner.isVisible({ timeout: 1000 }).catch(() => false)) {
    await expect(spinner).not.toBeVisible({ timeout })
  }

  // Brief stability pause for SPA hydration
  await page.waitForTimeout(300)
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
