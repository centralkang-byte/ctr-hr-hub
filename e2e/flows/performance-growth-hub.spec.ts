// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 평가/성장 허브 E2E (Wave1 IA)
// 프로토 PerfGrowthWrapper 정합: 목표·분기리뷰·자기평가 3탭 통합.
// 커버: 허브 렌더(3탭) · 탭 전환 ?tab= 딥링크 · 헤더 1차 액션 실행(새 목표 모달) ·
//        탭 keep-alive 상태 보존(자기평가 선택 → 왕복 → 유지) ·
//        데모션 루트(my-quarterly-review·/my/skills) 직접 URL 존속 · 멀티롤(EMPLOYEE/MANAGER/SUPER).
// (KPI 사이클 선택·D-day tz·요건맵 override 는 vitest growth-kpi 로 커버.)
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from '../helpers/auth'
import { waitForLoading, waitForPageReady } from '../helpers/wait-helpers'

const HUB = '/performance/growth'

test.describe('평가/성장 허브 — EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('허브 렌더: 3탭 + 목표 탭 헤더 액션(새 목표)', async ({ page }) => {
    await assertPageLoads(page, HUB)
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.getByRole('heading', { name: '평가 / 성장' })).toBeVisible({ timeout: 8000 })
    await expect(page.locator('[role="tab"]')).toHaveCount(3, { timeout: 8000 })
    // 기본 목표 탭 → 헤더 "새 목표" 액션 버튼 노출
    await expect(page.getByRole('button', { name: /새 목표/ })).toBeVisible({ timeout: 8000 })
  })

  test('헤더 액션 실행: 새 목표 클릭 → 목표 입력 모달 (가짜 toast 아님)', async ({ page }) => {
    await assertPageLoads(page, HUB)
    await waitForPageReady(page)
    await waitForLoading(page)

    await page.getByRole('button', { name: /새 목표/ }).first().click()
    // GoalModal 실제 입력 폼이 떠야 함 (헤더 버튼이 자식 핸들러를 실제 트리거)
    await expect(page.getByRole('heading', { name: /목표/ }).last()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('input[type="date"], textarea').first()).toBeVisible({ timeout: 5000 })
  })

  test('탭 전환 → URL ?tab= 동기화 + 헤더 액션 전환', async ({ page }) => {
    await assertPageLoads(page, HUB)
    await waitForPageReady(page)
    await waitForLoading(page)

    const tabs = page.locator('[role="tab"]')
    await tabs.nth(2).click() // 자기평가
    await expect(page).toHaveURL(/[?&]tab=skills/, { timeout: 8000 })
    await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true')
    // 자기평가 탭 → 헤더 액션이 "자기평가 저장"으로 전환 (callback-registration)
    await expect(page.getByRole('button', { name: /자기평가 저장/ })).toBeVisible({ timeout: 8000 })
  })

  test('?tab=skills 딥링크 → 자기평가 탭 활성', async ({ page }) => {
    await assertPageLoads(page, `${HUB}?tab=skills`)
    await waitForPageReady(page)
    await waitForLoading(page)
    await expect(page.locator('[role="tab"]').nth(2)).toHaveAttribute('aria-selected', 'true', { timeout: 8000 })
  })

  test('keep-alive: 자기평가 레벨 선택 → 다른 탭 갔다와도 보존', async ({ page }) => {
    await assertPageLoads(page, `${HUB}?tab=skills`)
    await waitForPageReady(page)
    await waitForLoading(page)

    // 첫 역량의 레벨 버튼(숫자 3) 선택 → completedCount 증가
    const levelBtn = page.getByRole('button', { name: /^3/ }).first()
    await levelBtn.click()
    await expect(levelBtn).toHaveClass(/border-primary/, { timeout: 5000 })

    // 목표 탭 → 자기평가 탭 왕복
    await page.locator('[role="tab"]').nth(0).click()
    await expect(page.locator('[role="tab"]').nth(0)).toHaveAttribute('aria-selected', 'true')
    await page.locator('[role="tab"]').nth(2).click()
    await expect(page.locator('[role="tab"]').nth(2)).toHaveAttribute('aria-selected', 'true')

    // 선택이 유지되어야 함 (언마운트 안 됨)
    await expect(page.getByRole('button', { name: /^3/ }).first()).toHaveClass(/border-primary/, { timeout: 5000 })
  })

  test('데모션 루트는 직접 URL 로 여전히 도달 (rail 에서만 내림)', async ({ page }) => {
    await assertPageLoads(page, '/performance/my-quarterly-review')
    await waitForPageReady(page)
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8000 })

    // /my/skills 는 organization/skill-matrix·team/skills 의 redirect 타깃 → 존속 필수
    await assertPageLoads(page, '/my/skills')
    await waitForPageReady(page)
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8000 })
  })
})

test.describe('평가/성장 허브 — MANAGER (개인 허브, 멀티롤)', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('MANAGER 도 개인 허브 렌더 (3탭)', async ({ page }) => {
    await assertPageLoads(page, HUB)
    await waitForPageReady(page)
    await waitForLoading(page)
    await expect(page.locator('[role="tab"]')).toHaveCount(3, { timeout: 8000 })
  })
})

test.describe('평가/성장 허브 — SUPER_ADMIN (멀티롤)', () => {
  test.use({ storageState: authFile('SUPER_ADMIN') })

  test('SUPER 도 개인 허브 렌더 (3탭)', async ({ page }) => {
    await assertPageLoads(page, HUB)
    await waitForPageReady(page)
    await waitForLoading(page)
    await expect(page.locator('[role="tab"]')).toHaveCount(3, { timeout: 8000 })
  })
})
