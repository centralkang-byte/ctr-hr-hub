// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Visual Baseline: 09 Settings & Compliance
// 3 pages × 2 themes = 6 baselines per viewport (18 total)
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
  { name: 'compliance', route: '/compliance' },
  { name: 'settings', route: '/settings' },
  { name: 'settings-organization', route: '/settings/organization' },
] as const

const THEMES = ['light', 'dark'] as const

test.describe('09-Settings Visual Baselines', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  for (const pg of PAGES) {
    for (const theme of THEMES) {
      test(`${pg.name}-${theme}`, async ({ visualPage: page }) => {
        await page.goto(pg.route)
        await setTheme(page, theme)
        await waitForVisualStability(page)

        await expect(page).toHaveScreenshot(`${pg.name}-${theme}.png`, {
          fullPage: true,
          mask: await maskDynamicContent(page),
        })
      })
    }
  }
})
