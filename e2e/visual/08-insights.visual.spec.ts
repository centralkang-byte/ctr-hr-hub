// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Visual Baseline: 08 Insights & Analytics
// 3 pages × 2 themes = 6 baselines per viewport (18 total)
// Charts are heavily masked due to Recharts non-determinism.
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
  { name: 'analytics', route: '/analytics' },
  { name: 'analytics-workforce', route: '/analytics/workforce' },
  { name: 'analytics-attendance', route: '/analytics/attendance' },
] as const

const THEMES = ['light', 'dark'] as const

test.describe('08-Insights Visual Baselines', () => {
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
