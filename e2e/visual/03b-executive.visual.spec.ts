// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Visual Baseline: 03b Executive
// 3 pages × 2 themes = 6 baselines per viewport (18 total)
// Codex: EXECUTIVE role coverage gap
// ═══════════════════════════════════════════════════════════

import { authFile } from '../helpers/auth'
import {
  test,
  expect,
  setTheme,
  waitForVisualStability,
  maskDynamicContent,
} from './helpers/visual-test-utils'

const PAGES = [
  { name: 'home-executive', route: '/home' },
  { name: 'analytics-executive', route: '/analytics' },
  { name: 'approvals-executive', route: '/approvals' },
] as const

const THEMES = ['light', 'dark'] as const

test.describe('03b-Executive Visual Baselines', () => {
  test.use({ storageState: authFile('EXECUTIVE') })

  for (const pg of PAGES) {
    for (const theme of THEMES) {
      test(`${pg.name}-${theme}`, async ({ visualPage: page }) => {
        await page.goto(pg.route)
        await setTheme(page, theme)
        await waitForVisualStability(page)

        await expect(page).toHaveScreenshot(`${pg.name}-${theme}.png`, {
          fullPage: false,
          mask: await maskDynamicContent(page),
        })
      })
    }
  }
})
