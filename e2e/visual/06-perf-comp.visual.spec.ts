// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Visual Baseline: 06 Performance & Compensation
// 6 pages × 2 themes = 12 baselines per viewport (36 total)
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
  { name: 'performance-admin', route: '/performance/admin' },
  { name: 'performance-calibration', route: '/performance/calibration' },
  { name: 'performance-goals', route: '/performance/goals' },
  { name: 'compensation', route: '/compensation' },
  { name: 'compensation-off-cycle', route: '/compensation/off-cycle' },
  { name: 'benefits', route: '/benefits' },
] as const

const THEMES = ['light', 'dark'] as const

test.describe('06-Performance & Compensation Visual Baselines', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

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
