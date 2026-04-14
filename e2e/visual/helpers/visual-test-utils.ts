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

// Frozen wall-clock for visual baselines: 2026-04-14 09:00 KST.
// Freezes Date.now/setTimeout/setInterval so D-day badges, current month,
// attendance elapsed timers, and clock-in countdowns render deterministically.
const FROZEN_TIME = new Date('2026-04-14T00:00:00.000Z') // 09:00 KST

export const test = base.extend<VisualFixtures>({
  visualPage: async ({ page, context }, use) => {
    // Set NEXT_LOCALE=ko cookie to ensure Korean locale (default is en)
    await context.addCookies([{
      name: 'NEXT_LOCALE',
      value: 'ko',
      domain: 'localhost',
      path: '/',
    }])

    // Pin Date.now() / new Date() to a fixed wall-clock so D-day, current
    // month, and clock-in countdowns render deterministically. setFixedTime()
    // leaves setTimeout/setInterval/requestAnimationFrame on real time, so
    // React hydration and SWR fetch flows still complete normally; animations
    // are separately disabled via DISABLE_ANIMATIONS_CSS above.
    await page.clock.setFixedTime(FROZEN_TIME)

    // Inject animation-disabling CSS (re-injected after navigation in waitForVisualStability)
    await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS })

    await use(page)
  },
})

export { expect }

// ─── Theme toggle ───────────────────────────────────────────

/**
 * Set the theme before navigation or screenshot.
 * Toggles the HTML class + sets localStorage for next-themes persistence.
 *
 * IMPORTANT: we re-inject DISABLE_ANIMATIONS_CSS **before** flipping the class
 * so the theme switch does not trigger any CSS transitions or animations
 * (background color, shadow, border, etc.). Without this, a transition may
 * still be in-flight when the screenshot is captured, which caused dark-theme
 * tests to drift between the generate pass and the twice-cold verify pass.
 */
export async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  // 1. Guarantee zero-duration animations/transitions BEFORE the flip.
  await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS })

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

  // Wait for CSS custom property recalculation + any post-flip paints.
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
 * during visual comparison: charts, clocks, relative timestamps, D-day
 * badges, and any element opted in via [data-mask="dynamic"].
 *
 * Clock-frozen content (D-day, current month) is mostly handled by
 * page.clock.install in the visualPage fixture, but mask selectors below
 * cover the cases where SSR pre-renders pre-freeze content or where the
 * value depends on database state rather than wall time.
 */
export async function maskDynamicContent(page: Page): Promise<Locator[]> {
  const masks: Locator[] = []

  const SELECTORS = [
    '.recharts-wrapper',     // Recharts chart containers
    'time[datetime]',        // Relative time elements (e.g., "3분 전")
    '[data-mask="dynamic"]', // Explicit opt-in for ad-hoc masking
    '[data-dday]',           // D-day badges (interview countdown, etc.)
    '.elapsed-time',         // Attendance elapsed timers
  ]

  for (const sel of SELECTORS) {
    const count = await page.locator(sel).count()
    if (count > 0) {
      masks.push(page.locator(sel))
    }
  }

  return masks
}
