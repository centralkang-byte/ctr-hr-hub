// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Visual Baseline: 03 Team
// 4 pages × 2 themes = 8 baselines per viewport (24 total)
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
  { name: 'manager-hub', route: '/manager-hub' },
  { name: 'attendance-team', route: '/attendance/team' },
  { name: 'performance-team-goals', route: '/performance/team-goals' },
  { name: 'performance-one-on-one', route: '/performance/one-on-one' },
] as const

const THEMES = ['light', 'dark'] as const

test.describe('03-Team Visual Baselines', () => {
  test.use({ storageState: authFile('MANAGER') })

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
