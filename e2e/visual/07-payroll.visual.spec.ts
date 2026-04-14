// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Visual Baseline: 07 Payroll
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
  { name: 'payroll', route: '/payroll' },
  { name: 'payroll-adjustments', route: '/payroll/adjustments' },
  { name: 'payroll-anomalies', route: '/payroll/anomalies' },
  { name: 'payroll-global', route: '/payroll/global' },
  { name: 'payroll-simulation', route: '/payroll/simulation' },
] as const

const THEMES = ['light', 'dark'] as const

test.describe('07-Payroll Visual Baselines', () => {
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
