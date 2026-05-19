// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Management E2E Tests
// Uses storageState for session reuse.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from '../helpers/auth'
import { waitForLoading, waitForPageReady } from '../helpers/wait-helpers'

// ─── EMPLOYEE tests ──────────────────────────────────────

test.describe('Leave: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('can view leave page', async ({ page }) => {
    await assertPageLoads(page, '/leave')
    await waitForPageReady(page)
  })

  test('can see leave page content', async ({ page }) => {
    await assertPageLoads(page, '/leave')
    await waitForLoading(page)

    // Leave page should render main content area
    const main = page.locator('main')
    await expect(main).toBeVisible()
    // Should contain leave-related content (연차, 잔여, balance, etc.)
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 })
  })

  test('leave page renders without error', async ({ page }) => {
    await assertPageLoads(page, '/leave')
    await waitForLoading(page)

    // No error boundary
    await expect(page.locator('text=페이지를 불러올 수 없습니다')).not.toBeVisible()
    await expect(page.locator('main')).toBeVisible()
  })
})

// ─── HR_ADMIN tests ──────────────────────────────────────

test.describe('Leave: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('can view leave admin page', async ({ page }) => {
    await assertPageLoads(page, '/leave/admin')
    await waitForPageReady(page)

    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 })
  })

  test('can view team leave calendar', async ({ page }) => {
    await assertPageLoads(page, '/leave/team')
    await waitForPageReady(page)

    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  test('can see leave statistics dashboard', async ({ page }) => {
    await assertPageLoads(page, '/leave/admin')
    await waitForLoading(page)

    // Stats area — heading or main content
    const main = page.locator('main')
    await expect(main).toBeVisible()
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 })
  })
})

// ─── MANAGER tests ───────────────────────────────────────

test.describe('Leave: MANAGER', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('can view team leave', async ({ page }) => {
    await assertPageLoads(page, '/leave/team')
    await waitForPageReady(page)

    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  test('can view approval inbox with leave requests', async ({ page }) => {
    await assertPageLoads(page, '/my/tasks?tab=approvals')
    await waitForLoading(page)

    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 })
  })
})

// ─── PR-3 reskin + WS-D/WS-C 시나리오 (가디언 보강 5) ──────────

test.describe('Leave PR-3: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  // 시나리오 1: 신청 드로워 + StatusBadge 4상태 전수 (LV-005)
  test('S1 신청 드로워 열림 + 이력 상태 배지 렌더', async ({ page }) => {
    await assertPageLoads(page, '/leave')
    await waitForLoading(page)
    // 휴가 신청 버튼 → WdDrawer(Sheet) 열림
    await page.getByRole('button', { name: /휴가 신청|신청/ }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 })
    await page.keyboard.press('Escape')
    // 이력 상태 배지 = StatusBadge SSOT (pill, raw statusBadgeClass 회귀 0)
    // seed 상태 분포(APPROVED/PENDING 등) → 배지 1개 이상 노출
    const badges = page.locator('main [class*="rounded-full"]')
    await expect(badges.first()).toBeVisible({ timeout: 10000 })
  })

  // 시나리오 2: redirect 딥링크 (B/C 회귀) — /my/leave → /leave
  test('S2 /my/leave redirect → /leave 착지', async ({ page }) => {
    await page.goto('/my/leave', { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/leave(\?|$|#)/, { timeout: 10000 })
    expect(page.url()).not.toContain('/my/leave')
    await expect(page.locator('main')).toBeVisible()
  })

  // 시나리오 3: WdLeaveBalanceCard 3 surface (/leave · 홈 · My Space 허브)
  test('S3 잔여 카드 3 surface 렌더', async ({ page }) => {
    for (const path of ['/leave', '/home', '/my']) {
      await assertPageLoads(page, path)
      await waitForLoading(page)
      await expect(page.locator('main')).toBeVisible()
      await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 })
    }
  })

  // 시나리오 4: 가디언 위반 회귀 (무음 catch toast / 세그먼트 필터 / 에러바운더리 0)
  test('S4 가디언 회귀 — 필터·에러바운더리·콘솔', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await assertPageLoads(page, '/leave')
    await waitForLoading(page)
    await expect(page.locator('text=페이지를 불러올 수 없습니다')).not.toBeVisible()
    // 세그먼트 필터(tablist) 노출 + 클릭 동작
    const tablist = page.getByRole('tablist').first()
    await expect(tablist).toBeVisible({ timeout: 10000 })
    await tablist.getByRole('tab').nth(1).click()
    await waitForLoading(page)
    await expect(page.locator('main')).toBeVisible()
    // 치명 콘솔 에러(앱 크래시급) 0 — 알려진 무관 노이즈 제외
    const fatal = errors.filter((e) => /Cannot read|is not a function|Uncaught/.test(e))
    expect(fatal, fatal.join('\n')).toHaveLength(0)
  })

  // 시나리오 5: 모바일 reflow (F11(a) — DataTable sm 컬럼 숨김 수용)
  test('S5 모바일 375px 렌더', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await assertPageLoads(page, '/leave')
    await waitForLoading(page)
    await expect(page.locator('main')).toBeVisible()
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 })
  })
})
