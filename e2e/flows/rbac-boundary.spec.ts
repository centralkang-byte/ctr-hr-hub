// ═══════════════════════════════════════════════════════════
// CTR HR Hub — RBAC Boundary E2E Tests
// Verifies that restricted pages block unauthorized roles.
// ═══════════════════════════════════════════════════════════

import { test, expect, type Locator, type Page } from '@playwright/test'
import { authFile, assertBlocked, assertPageLoads } from '../helpers/auth'

async function openCommandPalette(page: Page): Promise<Locator> {
  const trigger = page.getByRole('button', { name: /검색/ })
  const input = page.locator('div.fixed input[type="text"]')

  // The dashboard is server-rendered before the client handlers hydrate.
  // Retry the real trigger instead of racing the global keyboard listener.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (await input.isVisible()) return input
    await trigger.click()
    await page.waitForTimeout(300)
  }

  await expect(input).toBeVisible({ timeout: 5000 })
  return input
}

async function expandSidebarSection(
  page: Page,
  sectionName: string,
  expectedHref: string,
): Promise<void> {
  const sectionButton = page.getByRole('button', { name: sectionName })
  const expectedLink = page.locator(`a[href="${expectedHref}"]`)

  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (await expectedLink.isVisible()) return
    await sectionButton.click()
    await page.waitForTimeout(300)
  }

  await expect(expectedLink).toBeVisible({ timeout: 5000 })
}

// ─── EMPLOYEE boundaries ────────────────────────────────

test.describe('RBAC Boundary: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('blocked from payroll admin', async ({ page }) => {
    await assertBlocked(page, '/payroll')
  })

  test('blocked from compensation', async ({ page }) => {
    await assertBlocked(page, '/compensation')
  })

  test('blocked from settings', async ({ page }) => {
    await assertBlocked(page, '/settings')
  })

  test('blocked from compliance', async ({ page }) => {
    await assertBlocked(page, '/compliance')
  })
})

// ─── MANAGER boundaries ────────────────────────────────

test.describe('RBAC Boundary: MANAGER', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('blocked from recruitment', async ({ page }) => {
    await assertBlocked(page, '/recruitment')
  })

  test('blocked from settings', async ({ page }) => {
    await assertBlocked(page, '/settings')
  })

  test('blocked from succession aliases and gender pay gap', async ({ page }) => {
    await assertBlocked(page, '/succession')
    await assertBlocked(page, '/talent/succession')
    await assertBlocked(page, '/analytics/gender-pay-gap')
  })

  test('command palette hides succession', async ({ page }) => {
    await assertPageLoads(page, '/home')
    const input = await openCommandPalette(page)
    await input.fill('승계')
    await page.waitForTimeout(400)
    await expect(page.getByRole('button', { name: '승계 계획' })).toHaveCount(0)

    await page.locator('div.fixed input[type="text"]').fill('홈')
    await page.waitForTimeout(400)
    await expect(page.getByRole('button', { name: '홈' })).toBeVisible()
  })

  test('command palette removes stale restricted recent pages', async ({ page }) => {
    await assertPageLoads(page, '/home')
    await page.evaluate(() => {
      localStorage.setItem('ctr-recent-pages', JSON.stringify([
        { path: '/talent/succession', title: '승계 계획', timestamp: Date.now() },
        { path: '/home', title: '홈', timestamp: Date.now() - 1 },
      ]))
    })
    await page.reload({ waitUntil: 'domcontentloaded' })

    await openCommandPalette(page)
    await expect(page.getByRole('button', { name: /승계 계획/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /홈/ })).toBeVisible()
  })
})

// ─── EXECUTIVE boundaries ──────────────────────────────

test.describe('RBAC Boundary: EXECUTIVE', () => {
  test.use({ storageState: authFile('EXECUTIVE') })

  test('blocked from succession aliases and gender pay gap', async ({ page }) => {
    await assertBlocked(page, '/succession')
    await assertBlocked(page, '/talent/succession')
    await assertBlocked(page, '/analytics/gender-pay-gap')
  })
})

// ─── HR_ADMIN visibility ───────────────────────────────

test.describe('RBAC Boundary: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('can access succession aliases and gender pay gap', async ({ page }) => {
    for (const path of ['/succession', '/talent/succession', '/analytics/gender-pay-gap']) {
      await assertPageLoads(page, path)
      expect(new URL(page.url()).pathname).toBe(path)
      expect(page.url()).not.toContain('error=forbidden')
    }
  })

  test('sidebar and command palette expose approved HR routes', async ({ page }) => {
    await assertPageLoads(page, '/home')

    await expandSidebarSection(page, '채용', '/recruitment/talent-pool')
    await expect(page.locator('a[href="/recruitment/talent-pool"]')).toBeVisible()
    await expect(page.locator('a[href="/talent/succession"]')).toBeVisible()

    await expandSidebarSection(page, '성과/보상', '/analytics/gender-pay-gap')
    await expect(page.locator('a[href="/analytics/gender-pay-gap"]')).toBeVisible()

    const input = await openCommandPalette(page)
    await input.fill('승계')
    await page.waitForTimeout(400)
    await expect(page.getByRole('button', { name: '승계 계획' })).toBeVisible()
  })
})
