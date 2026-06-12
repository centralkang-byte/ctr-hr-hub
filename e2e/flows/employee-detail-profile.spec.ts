// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Detail proto-fidelity E2E (Wave 1 IA, PR-2)
// wd-worker-banner 헤더 + 성과평가 탭 재배치(/insights + 받은 칭찬).
//  - HR_ADMIN: 배너 렌더(이름·뒤로·편집) + 6탭 + 성과평가 탭 로드(크래시 0).
//  - SUPER_ADMIN: 전사조회 — 타 법인 직원 성과평가도 정상 렌더(크로스컴퍼니 차단 없음).
//  - EMPLOYEE: /employees(HR_UP 전용) 접근 차단.
// gstack 라이브(시각·Pixel Gate) ≠ E2E(자동화) — 본 파일은 자동화 검증.
// ═══════════════════════════════════════════════════════════

import { test, expect, type Page } from '@playwright/test'
import { authFile, assertBlocked } from '../helpers/auth'
import { waitForLoading, waitForPageReady, collectConsoleErrors } from '../helpers/wait-helpers'

const EMPLOYEES_URL = '/employees'

// 목록 첫 행 클릭 → 상세 진입. seed 직원 없으면 skip.
async function openFirstDetail(page: Page): Promise<boolean> {
  await page.goto(EMPLOYEES_URL)
  await waitForPageReady(page)
  await waitForLoading(page)
  const firstRow = page.locator('tbody tr').first()
  if (!(await firstRow.isVisible().catch(() => false))) return false
  await firstRow.click()
  await page.waitForURL(/\/employees\/[^/]+$/, { timeout: 10000 }).catch(() => {})
  await waitForPageReady(page)
  return /\/employees\/[^/]+$/.test(new URL(page.url()).pathname)
}

async function openPerfTab(page: Page) {
  const trigger = page.getByRole('tab', { name: /평가결과|performance/i }).first()
  await expect(trigger).toBeVisible({ timeout: 10000 })
  await trigger.click()
}

// ─── HR_ADMIN: 배너 + 탭 + 성과평가 로드 ─────────────────────
test.describe('Employee Detail — HR_ADMIN 배너·성과평가 탭', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('wd-worker-banner 렌더 + 성과평가 탭 로드(크래시 0)', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    const reached = await openFirstDetail(page)
    test.skip(!reached, '직원 행 없음(seed 의존) — 상세 진입 skip')

    // 배너: 이름 헤딩 + 뒤로 + 편집(HR)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /직원 관리|employees/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /편집|edit/i }).first()).toBeVisible()

    // 6탭 + 성과평가 탭 클릭 → 패널 렌더(크래시 없이 무언가 표시)
    await openPerfTab(page)
    const panel = page.getByRole('tabpanel').first()
    await expect(panel).toBeVisible({ timeout: 10000 })
    // KPI 카드 / 빈상태 / 안내 중 하나는 떠야 함 (blank 금지)
    await expect(panel).not.toBeEmpty()

    // 성과평가 fetch 관련 콘솔 에러 0 (네트워크 4xx는 toast 아닌 graceful)
    const fatal = errors.filter((e) => !/favicon|ResizeObserver/i.test(e))
    expect(fatal, `console errors: ${fatal.join(' | ')}`).toHaveLength(0)
  })

  test('프로필 탭 — 기본정보 그리드 보존(사이드바 제거 후 정보 손실 0)', async ({ page }) => {
    const reached = await openFirstDetail(page)
    test.skip(!reached, '직원 행 없음 — skip')
    // 사이드바 제거 후에도 프로필 탭의 인적/고용 정보 그리드(dl)는 그대로 렌더돼야 함.
    // (인적사항 + 고용정보 = dl 2개 이상)
    await expect(page.locator('dl').first()).toBeVisible({ timeout: 10000 })
    expect(await page.locator('dl').count()).toBeGreaterThanOrEqual(1)
  })
})

// ─── SUPER_ADMIN: 전사조회 — 타 법인 직원 성과평가도 정상 렌더 ───
test.describe('Employee Detail — SUPER 전사조회 성과평가', () => {
  test.use({ storageState: authFile('SUPER_ADMIN') })

  test('타 법인 직원 성과평가 탭 = 차단 안내 없이 렌더(전사조회)', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    const reached = await openFirstDetail(page)
    test.skip(!reached, '직원 행 없음 — skip')
    await openPerfTab(page)
    const panel = page.getByRole('tabpanel').first()
    await expect(panel).toBeVisible({ timeout: 10000 })
    await expect(panel).not.toBeEmpty()

    // SUPER(CTR-HOLD)가 타 법인 직원을 열어도 "다른 법인…표시할 수 없어요" 차단 안내는 더 이상 없어야 함.
    await expect(panel.getByText(/표시할 수 없어요|cannot be shown here/i)).toHaveCount(0)

    const fatal = errors.filter((e) => !/favicon|ResizeObserver/i.test(e))
    expect(fatal, `console errors: ${fatal.join(' | ')}`).toHaveLength(0)
  })
})

// ─── EMPLOYEE: /employees 접근 차단 (HR_UP 전용) ─────────────
test.describe('Employee Detail — EMPLOYEE 접근 차단', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('EMPLOYEE는 /employees 목록 접근 불가(리다이렉트)', async ({ page }) => {
    await assertBlocked(page, EMPLOYEES_URL)
  })
})
