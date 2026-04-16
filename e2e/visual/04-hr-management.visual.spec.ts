// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Visual Baseline: 04 HR Management
// 12 pages × 2 themes = 24 baselines per viewport (72 total)
// ═══════════════════════════════════════════════════════════

import { authFile } from '../helpers/auth'
import { resolveSeedData } from '../helpers/test-data'
import {
  test,
  expect,
  setTheme,
  waitForVisualStability,
  maskDynamicContent,
} from './helpers/visual-test-utils'

const THEMES = ['light', 'dark'] as const

// ─── HR_ADMIN pages ─────────────────────────────────────────
const HR_PAGES = [
  { name: 'employees', route: '/employees' },
  { name: 'employees-new', route: '/employees/new' },
  { name: 'org', route: '/org' },
  { name: 'attendance-admin', route: '/attendance/admin' },
  { name: 'leave-admin', route: '/leave/admin' },
  { name: 'onboarding', route: '/onboarding' },
  { name: 'offboarding', route: '/offboarding' },
  { name: 'discipline', route: '/discipline' },
  { name: 'approvals', route: '/approvals' },
  { name: 'bulk-movements', route: '/hr/bulk-movements' },
] as const

test.describe('04-HR Management Visual Baselines', () => {
  // HR_ADMIN pages (10 static routes)
  test.describe('HR Admin', () => {
    test.use({ storageState: authFile('HR_ADMIN') })

    for (const pg of HR_PAGES) {
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

    // Employee detail (dynamic ID) — fullPage for long content
    test.describe('Employee Detail', () => {
      let employeeId: string

      test.beforeAll(async ({ request }) => {
        const seed = await resolveSeedData(request)
        employeeId = seed.employeeId
      })

      for (const theme of THEMES) {
        test(`employees-detail-${theme}`, async ({ visualPage: page }) => {
          await page.goto(`/employees/${employeeId}`)
          await setTheme(page, theme)
          await waitForVisualStability(page)

          await expect(page).toHaveScreenshot(`employees-detail-${theme}.png`, {
            fullPage: true,
            mask: await maskDynamicContent(page),
          })
        })
      }
    })
  })

  // Directory (accessible to all roles)
  test.describe('Directory', () => {
    test.use({ storageState: authFile('EMPLOYEE') })

    for (const theme of THEMES) {
      test(`directory-${theme}`, async ({ visualPage: page }) => {
        await page.goto('/directory')
        await setTheme(page, theme)
        await waitForVisualStability(page)

        await expect(page).toHaveScreenshot(`directory-${theme}.png`, {
          fullPage: false,
          mask: await maskDynamicContent(page),
        })
      })
    }
  })
})
