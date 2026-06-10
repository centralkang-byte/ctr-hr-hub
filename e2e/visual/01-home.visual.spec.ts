// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Visual Baseline: 01 Home
// EMPLOYEE: 2 pages × 2 themes + HR_ADMIN: 1 page × 2 themes
// = 6 baselines per viewport (18 total)
// HR_ADMIN 블록 = Wave 1 (Codex G1 P0-1): 홈 개편이 HR admin 화면이라
// EMPLOYEE 전용 촬영으로는 visual 미검증이었음
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

test.describe('01-Home Visual Baselines (HR Admin)', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  for (const theme of THEMES) {
    test(`home-hr-admin-${theme}`, async ({ visualPage: page }) => {
      await page.goto('/home')
      await setTheme(page, theme)
      await waitForVisualStability(page)

      await expect(page).toHaveScreenshot(`home-hr-admin-${theme}.png`, {
        fullPage: false,
        mask: await maskDynamicContent(page),
      })
    })
  }
})
