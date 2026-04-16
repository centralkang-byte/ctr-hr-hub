// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Visual Baseline: 02 My Space
// 12 pages × 2 themes = 24 baselines per viewport (72 total)
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
  { name: 'my-profile', route: '/my/profile' },
  { name: 'my-tasks', route: '/my/tasks' },
  { name: 'attendance', route: '/attendance' },
  { name: 'leave', route: '/leave' },
  { name: 'leave-of-absence', route: '/leave-of-absence' },
  { name: 'my-benefits', route: '/my/benefits' },
  { name: 'performance', route: '/performance' },
  { name: 'performance-recognition', route: '/performance/recognition' },
  { name: 'my-skills', route: '/my/skills' },
  { name: 'my-training', route: '/my/training' },
  { name: 'my-documents', route: '/my/documents' },
] as const

const THEMES = ['light', 'dark'] as const

test.describe('02-My Space Visual Baselines', () => {
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
