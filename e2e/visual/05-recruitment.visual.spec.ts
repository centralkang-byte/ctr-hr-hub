// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Visual Baseline: 05 Recruitment
// 5 pages × 2 themes = 10 baselines per viewport (30 total)
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
  { name: 'recruitment', route: '/recruitment' },
  { name: 'recruitment-dashboard', route: '/recruitment/dashboard' },
  { name: 'recruitment-board', route: '/recruitment/board' },
  { name: 'recruitment-talent-pool', route: '/recruitment/talent-pool' },
  { name: 'recruitment-requisitions', route: '/recruitment/requisitions' },
] as const

const THEMES = ['light', 'dark'] as const

test.describe('05-Recruitment Visual Baselines', () => {
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
