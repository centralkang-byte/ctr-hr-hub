// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Visual Baseline: 01 Home
// 2 pages × 2 themes = 4 baselines per viewport (12 total)
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
  { name: 'home', route: '/home' },
  { name: 'notifications', route: '/notifications' },
] as const

const THEMES = ['light', 'dark'] as const

test.describe('01-Home Visual Baselines', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

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
