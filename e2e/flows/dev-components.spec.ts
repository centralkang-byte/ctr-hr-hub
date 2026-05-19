// ═══════════════════════════════════════════════════════════
// CTR HR Hub — DEV 컴포넌트 픽스처 + 가드 E2E (PR-1)
//
// CI webServer = `npm run start` (prod, NODE_ENV=production) →
// /dev/components 가드(notFound + config redirect)로 404.
// 로컬 = dev 서버(reuseExistingServer) → 라우트 렌더 → 컴포넌트 N2.
// 따라서:
//   - 가드 테스트: CI(prod)에서만 의미 → CI 한정 실행, 404 단언
//   - 컴포넌트 N2: 로컬 dev 한정 → CI skip
// (컴포넌트 시각 N2 = 로컬 게이트. CI 는 가드만. diff 검토 보고.)
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'

const IN_CI = !!process.env.CI

// ─── 가드 (production 라우트 비노출) ─────────────────────────

test.describe('DEV route guard', () => {
  test.skip(!IN_CI, '가드는 prod 서버(CI)에서만 검증 가능')

  test('production: /dev/components 비노출 (404 또는 redirect)', async ({ page }) => {
    const res = await page.goto('/dev/components', { waitUntil: 'domcontentloaded' })
    // notFound() → 404 / config redirect → '/' 착지. 둘 중 하나면 비노출 충족.
    const status = res?.status() ?? 0
    const url = page.url()
    const blocked = status === 404 || !url.includes('/dev/components')
    expect(blocked, `status=${status} url=${url}`).toBeTruthy()
  })
})

// ─── 컴포넌트 N2 (로컬 dev — 시각/구조 단언) ─────────────────

test.describe('WdGroupedStatCard 컴포넌트 N2', () => {
  test.skip(IN_CI, 'dev 픽스처 라우트는 prod/CI 비노출 — 로컬 dev 게이트')

  test.beforeEach(async ({ page }) => {
    await page.goto('/dev/components', { waitUntil: 'networkidle' })
  })

  test('Q7 임계 매핑: 30→success / 29→accent / 9→warning / total0→neutral', async ({ page }) => {
    const q7 = page.getByTestId('fx-q7')
    await expect(q7).toBeVisible()
    const bars = q7.locator('[role="progressbar"] > div')
    await expect(bars).toHaveCount(4)
    await expect(bars.nth(0)).toHaveClass(/bg-tertiary/)          // 30% success
    await expect(bars.nth(1)).toHaveClass(/bg-wt-4/)              // 29% accent
    await expect(bars.nth(2)).toHaveClass(/bg-warning-bright/)    // 9% warning
    await expect(bars.nth(3)).toHaveClass(/bg-muted-foreground/)  // total0 neutral
  })

  test('cards 멀티카테고리: 그룹 라벨 + 미니카드 렌더', async ({ page }) => {
    const fx = page.getByTestId('fx-leave-multicat')
    await expect(fx).toBeVisible()
    await expect(fx.locator('[role="listitem"]')).toHaveCount(4)
    await expect(fx.locator('[role="progressbar"]')).toHaveCount(4)
  })

  test('rows: progress 無, 라벨↔값 목록', async ({ page }) => {
    const fx = page.getByTestId('fx-rows')
    await expect(fx).toBeVisible()
    await expect(fx.locator('[role="listitem"]')).toHaveCount(5)
    await expect(fx.locator('[role="progressbar"]')).toHaveCount(0)
    await expect(fx.getByText('월간 통계')).toBeVisible()
  })

  test('빈 groups → EmptyState SSOT', async ({ page }) => {
    const fx = page.getByTestId('fx-empty')
    await expect(fx).toBeVisible()
    await expect(fx.locator('[role="listitem"]')).toHaveCount(0)
    // EmptyState 아이콘(svg) 노출
    await expect(fx.locator('svg').first()).toBeVisible()
  })

  test('loading → null (섹션 내용 없음)', async ({ page }) => {
    const fx = page.getByTestId('fx-loading')
    await expect(fx).toBeVisible()
    await expect(fx.locator('section')).toHaveCount(0)
  })
})
