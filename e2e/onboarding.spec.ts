// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Onboarding & Offboarding E2E Tests
// Covers HR admin dashboard, offboarding cases, employee self-view,
// and the 5-tab plan-type filter on the onboarding dashboard.
//
// Requires:
//   1. Dev server running (npm run dev)
//   2. NEXT_PUBLIC_SHOW_TEST_ACCOUNTS=true in .env
//   3. Seeded test accounts
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { loginAs, assertPageLoads } from './helpers/auth'
import { waitForLoading, waitForPageReady } from './helpers/wait-helpers'

test.describe('Onboarding & Offboarding', () => {
  // ─── HR Admin: Onboarding Dashboard ──────────────────────

  test('HR_ADMIN can view onboarding dashboard', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/onboarding')
    await waitForPageReady(page)

    // planType 탭 버튼: 전체 / 온보딩 / 오프보딩 / 크로스보딩 출발 / 크로스보딩 도착
    // 대시보드는 button 태그로 렌더링 (shadcn Tabs 아님)
    const tabAll = page.locator('button:has-text("전체")')
    await expect(tabAll).toBeVisible({ timeout: 10000 })

    const tabOnboarding = page.locator('button:has-text("온보딩")')
    await expect(tabOnboarding).toBeVisible({ timeout: 5000 })

    const tabOffboarding = page.locator('button:has-text("오프보딩")')
    await expect(tabOffboarding).toBeVisible({ timeout: 5000 })
  })

  // ─── HR Admin: Offboarding Cases ─────────────────────────

  test('HR_ADMIN can view offboarding cases', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/offboarding')
    await waitForLoading(page)

    // 오프보딩 페이지: 상태 탭(진행중/완료) 또는 테이블 렌더링 확인
    // OffboardingDashboardClient 는 shadcn Tabs 를 사용
    const inProgressTab = page.locator('[role="tab"]:has-text("진행"), [role="tab"]:has-text("IN_PROGRESS"), button:has-text("진행")')
    const tableOrContent = page.locator('table, [role="table"], [class*="card"], [class*="Card"]')

    // 탭 또는 테이블 중 하나가 보여야 함
    await expect(inProgressTab.or(tableOrContent).first()).toBeVisible({ timeout: 10000 })

    // D-day 뱃지 또는 퇴직 처리 관련 텍스트 확인
    const ddayOrStatus = page.locator(
      'text=D-, text=진행중, text=완료, text=퇴직, [class*="badge"], [class*="Badge"]',
    ).first()
    await expect(ddayOrStatus).toBeVisible({ timeout: 10000 })
  })

  // ─── Employee: My Onboarding Self-View ───────────────────

  test('EMPLOYEE can access my onboarding page', async ({ page }) => {
    await loginAs(page, 'EMPLOYEE')
    await assertPageLoads(page, '/onboarding/me')
    await waitForPageReady(page)

    // 환영 배너, 진행률, 태스크 목록 중 하나가 렌더링되어야 함
    const content = page.locator(
      'h1, h2, text=온보딩, text=내 온보딩, text=진행, [class*="progress"], [class*="Progress"], [class*="task"], [class*="Task"]',
    ).first()
    await expect(content).toBeVisible({ timeout: 10000 })
  })

  // ─── HR Admin: Onboarding Shows 5 Plan-Type Tabs ─────────

  test('HR_ADMIN onboarding dashboard shows 5 plan-type tabs', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
    await assertPageLoads(page, '/onboarding')
    await waitForPageReady(page)

    // PLAN_TYPE_TABS: 전체 / 온보딩 / 오프보딩 / 크로스보딩 출발 / 크로스보딩 도착
    const expectedLabels = ['전체', '온보딩', '오프보딩', '크로스보딩 출발', '크로스보딩 도착']

    for (const label of expectedLabels) {
      const tab = page.locator(`button:has-text("${label}")`).first()
      await expect(tab).toBeVisible({ timeout: 10000 })
    }

    // 탭이 클릭 가능한지 확인 (전체 → 온보딩 전환)
    await page.locator('button:has-text("온보딩")').first().click()
    await waitForLoading(page)

    // 선택된 탭이 활성 스타일을 가지는지 확인 (border-b-2 클래스)
    const activeTab = page.locator('button:has-text("온보딩")').first()
    await expect(activeTab).toHaveClass(/border-b-2/, { timeout: 3000 })
  })
})
