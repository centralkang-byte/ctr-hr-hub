// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Visual Regression Test Utilities
// Custom fixture + helpers for deterministic screenshots.
// ═══════════════════════════════════════════════════════════

import { test as base, expect, type Page, type Locator } from '@playwright/test'
import { waitForPageReady } from '../../helpers/wait-helpers'

// ─── CSS to disable animations & caret for deterministic screenshots ───
const DISABLE_ANIMATIONS_CSS = `
*, *::before, *::after {
  animation-duration: 0s !important;
  transition-duration: 0s !important;
  caret-color: transparent !important;
}
`

// ─── Custom test fixture ────────────────────────────────────
type VisualFixtures = {
  visualPage: Page
}

export const test = base.extend<VisualFixtures>({
  visualPage: async ({ page, context }, use) => {
    // Set NEXT_LOCALE=ko cookie to ensure Korean locale (default is en)
    await context.addCookies([{
      name: 'NEXT_LOCALE',
      value: 'ko',
      domain: 'localhost',
      path: '/',
    }])

    // Inject animation-disabling CSS
    await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS })

    await use(page)
  },
})

export { expect }

// ─── Theme toggle ───────────────────────────────────────────

/**
 * Set the theme before navigation or screenshot.
 * Toggles the HTML class + sets localStorage for next-themes persistence.
 */
export async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((t) => {
    // Set localStorage for next-themes state
    localStorage.setItem('theme', t)

    // Toggle class directly for immediate effect
    if (t === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    }
  }, theme)

  // Wait for CSS custom property recalculation
  await page.waitForTimeout(300)
}

// ─── Page stability ─────────────────────────────────────────

/**
 * Wait for the page to be visually stable for screenshots.
 * Extends waitForPageReady with visual-specific checks.
 */
export async function waitForVisualStability(page: Page): Promise<void> {
  // 1. Base stability: DOM loaded, skeletons/spinners gone
  await waitForPageReady(page)

  // 2. Re-inject animation disabling (in case page navigation reset it)
  await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS })

  // 3. Wait for fonts to load
  await page.evaluate(() => document.fonts.ready).catch(() => {
    // fonts.ready may not be available in all contexts
  })

  // 4. Wait for all images to load
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images).map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((r) => {
              img.onload = () => r()
              img.onerror = () => r()
            }),
      ),
    ),
  ).catch(() => {})

  // 5. Wait for Recharts SVGs to stabilize (if any)
  await page
    .waitForFunction(
      () => {
        const surfaces = document.querySelectorAll('.recharts-surface')
        if (surfaces.length === 0) return true
        return Array.from(surfaces).every((s) => s.getAttribute('width'))
      },
      { timeout: 3000 },
    )
    .catch(() => {
      // No charts or timeout — proceed anyway
    })

  // 6. Final layout paint settle
  await page.waitForTimeout(500)
}

// ─── Dynamic content masking ────────────────────────────────

/**
 * Returns locators for non-deterministic content that should be masked
 * during visual comparison: charts, clocks, relative timestamps.
 */
export async function maskDynamicContent(page: Page): Promise<Locator[]> {
  const masks: Locator[] = []

  // Mask Recharts chart containers
  const chartCount = await page.locator('.recharts-wrapper').count()
  if (chartCount > 0) {
    masks.push(page.locator('.recharts-wrapper'))
  }

  // Mask relative time elements (e.g., "3분 전", "2 hours ago")
  const timeAgoCount = await page.locator('time[datetime]').count()
  if (timeAgoCount > 0) {
    masks.push(page.locator('time[datetime]'))
  }

  return masks
}
