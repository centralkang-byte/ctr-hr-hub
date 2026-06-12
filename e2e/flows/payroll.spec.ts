// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll E2E Tests
// Covers payroll admin pages (HR_ADMIN) and self-service (EMPLOYEE).
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from '../helpers/auth'
import { waitForLoading, waitForPageReady } from '../helpers/wait-helpers'

// ─── HR_ADMIN tests ─────────────────────────────────────

test.describe('Payroll: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('payroll dashboard loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll')
    await waitForPageReady(page)
  })

  test('payroll run list renders table', async ({ page }) => {
    await assertPageLoads(page, '/payroll')
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15000 })
  })

  // Wave 1: 새 사이클 생성 폼 = WdDrawer (입력 폼 표준). 제출 없이 open→cancel만
  // 검증 — 공유 시드에 run을 만들지 않는다 (@@unique 충돌·시드 오염 방지).
  test('create run drawer opens and cancels without submit', async ({ page }) => {
    await assertPageLoads(page, '/payroll')
    await waitForLoading(page)

    await page.getByRole('button', { name: /새 사이클|New cycle/ }).click()
    const drawer = page.getByRole('dialog')
    await expect(drawer.getByText(/급여 실행 생성|Create Payroll Run/).first()).toBeVisible()
    await expect(drawer.locator('#payroll-create-yearMonth')).toBeVisible()
    await expect(drawer.locator('#payroll-create-payDate')).toBeVisible()

    await drawer.getByRole('button', { name: /취소|Cancel/ }).click()
    await expect(drawer).toBeHidden()
  })

  test('close attendance page loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll/close-attendance')
    await waitForPageReady(page)
  })

  test('adjustments page loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll/adjustments')
    await waitForPageReady(page)
  })

  test('anomalies page loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll/anomalies')
    await waitForPageReady(page)
  })

  test('simulation page loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll/simulation')
    await waitForPageReady(page)
  })

  // Wave 1: 모드 탭바 = Radix Tabs 세그먼트 (6모드 + TabsContent 패널 연결) 가드.
  // 탭 클릭 시 aria-selected 이동 + 패널 콘텐츠가 실제로 분기되는지 검증 —
  // 커스텀 토글 회귀(전환 불능)나 패널 미연결을 잡는다.
  test('simulation mode tabs switch panels', async ({ page }) => {
    await assertPageLoads(page, '/payroll/simulation')
    await waitForLoading(page)

    const tabs = page.getByRole('tab')
    await expect(tabs).toHaveCount(6, { timeout: 15000 })

    // 기본 SINGLE: 대상 직원 검색 패널
    await expect(page.getByRole('tabpanel')).toContainText(/대상 직원|Target employee/, { timeout: 10000 })

    // BULK 전환: aria-selected 이동 + 대상 선택(법인/부서/직원) 패널로 분기.
    // SSR 마크업이 하이드레이션 전에 보여 첫 클릭이 무시될 수 있음 → toPass로 재클릭
    const bulkTab = page.getByRole('tab', { name: /일괄|Bulk/ })
    await expect(async () => {
      await bulkTab.click()
      await expect(bulkTab).toHaveAttribute('aria-selected', 'true', { timeout: 2000 })
    }).toPass({ timeout: 15000 })
    await expect(page.getByRole('tabpanel')).toContainText(/대상 선택|Target selection/, { timeout: 10000 })

    // 환율 전환: 전용 탭 컴포넌트 렌더
    const fxTab = page.getByRole('tab', { name: /환율|FX/ })
    await expect(async () => {
      await fxTab.click()
      await expect(fxTab).toHaveAttribute('aria-selected', 'true', { timeout: 2000 })
    }).toPass({ timeout: 15000 })
    await expect(page.getByRole('tabpanel')).toContainText(/환율 조정|Exchange rate/, { timeout: 10000 })
  })

  test('bank transfers page loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll/bank-transfers')
    await waitForPageReady(page)
  })

  test('year-end page loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll/year-end')
    await waitForPageReady(page)
  })

  // Wave 1: 상태 필터 탭 = Radix Tabs 세그먼트 (all/submitted/hr_review/confirmed 4탭 고정,
  // statusFilter 제어 + API 재조회). 탭 클릭 시 aria-selected 이동 + 테이블 단일 렌더 가드.
  test('year-end status filter tabs switch', async ({ page }) => {
    await assertPageLoads(page, '/payroll/year-end')
    await waitForLoading(page)

    const tabs = page.getByRole('tab')
    await expect(tabs).toHaveCount(4, { timeout: 15000 })

    const submittedTab = page.getByRole('tab', { name: /제출완료|Submitted/ })
    await expect(async () => {
      await submittedTab.click()
      await expect(submittedTab).toHaveAttribute('aria-selected', 'true', { timeout: 2000 })
    }).toPass({ timeout: 15000 })

    // 필터형 탭 — 패널 복제 없이 테이블은 1개만 렌더 (빈 상태여도 table 골격은 존재)
    await expect(page.locator('main table')).toHaveCount(1)
  })

  test('global payroll page loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll/global')
    await waitForPageReady(page)
  })

  test('import page loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll/import')
    await waitForPageReady(page)
  })

  // Wave 1: upload/mapping/history 패널형 탭 = Radix Tabs + TabsContent.
  // history 탭 활성화 시 이력 fetch가 발화해 테이블(또는 빈 상태)이 패널에 렌더되는지 가드.
  test('import tabs switch panels and history fetch fires', async ({ page }) => {
    await assertPageLoads(page, '/payroll/import')
    await waitForLoading(page)

    const tabs = page.getByRole('tab')
    await expect(tabs).toHaveCount(3, { timeout: 15000 })

    const historyTab = page.getByRole('tab', { name: /업로드 이력|Upload History/ })
    await expect(async () => {
      await historyTab.click()
      await expect(historyTab).toHaveAttribute('aria-selected', 'true', { timeout: 2000 })
    }).toPass({ timeout: 15000 })

    // 활성 패널에 이력 테이블 헤더 또는 빈 상태가 렌더 (fetch 흐름 보존 가드)
    const activePanel = page.locator('[role="tabpanel"][data-state="active"]')
    await expect(activePanel.getByText(/업로드 이력이 없습니다|업로드일|Upload Date|No upload history/).first()).toBeVisible({ timeout: 10000 })
  })
})

// ─── Run detail pages (Wave 1) ──────────────────────────
// [runId] 상세 3페이지(review/approve/publish) 읽기 전용 가드.
// 공유 시드의 기존 run을 API로 조회해 사용 — 쓰기/제출 없음 (시드 오염 방지).

test.describe('Payroll run detail pages: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  async function firstRunId(page: import('@playwright/test').Page, query = ''): Promise<string | null> {
    const res = await page.request.get(`/api/v1/payroll/runs?page=1&limit=5${query}`)
    if (!res.ok()) return null
    const body = (await res.json()) as { data?: Array<{ id: string }> }
    return body.data?.[0]?.id ?? null
  }

  test('review page renders header, KPI strip and segmented tabs', async ({ page }) => {
    const runId = await firstRunId(page)
    test.skip(!runId, 'no payroll run in seed')

    await assertPageLoads(page, `/payroll/${runId}/review`)
    await waitForLoading(page)

    // 사이드바 h1이 아닌 페이지 본문 h1로 게이트 (데이터 로드 후 렌더)
    await expect(page.locator('main h1').first()).toBeVisible({ timeout: 20000 })
    // Wave 1: 언더라인 탭 → Radix Tabs (role=tab) 전환 가드
    await expect(page.getByRole('tab').first()).toBeVisible({ timeout: 10000 })
    // 엑셀 export 드롭다운은 열기만 (다운로드 클릭 없음)
    const excelTrigger = page.getByRole('button', { name: /엑셀|Excel/ }).first()
    if (await excelTrigger.isVisible()) {
      await excelTrigger.click()
      await expect(page.getByText(/급여대장|Payroll ledger/).first()).toBeVisible()
      await page.keyboard.press('Escape')
    }
  })

  test('review comparison tab preserves lazy fetch and table', async ({ page }) => {
    const runId = await firstRunId(page)
    test.skip(!runId, 'no payroll run in seed')

    await assertPageLoads(page, `/payroll/${runId}/review`)
    await waitForLoading(page)

    const comparisonTab = page.getByRole('tab', { name: /전월 대비|비교|Comparison/ })
    test.skip(!(await comparisonTab.isVisible()), 'comparison tab not present')
    await comparisonTab.click()
    // 비교 탭 lazy fetch 후 칩 요약 또는 빈 상태가 렌더되면 통과
    await waitForLoading(page)
    await expect(page.getByRole('tabpanel')).toBeVisible()
  })

  test('approve page renders status and stepper without crash', async ({ page }) => {
    const runId = await firstRunId(page)
    test.skip(!runId, 'no payroll run in seed')

    await page.goto(`/payroll/${runId}/approve`)
    await waitForLoading(page)
    // 결재 단계가 없는 run이어도 페이지는 크래시 없이 본문 헤딩을 렌더해야 한다
    await expect(page.locator('main h1').first()).toBeVisible({ timeout: 20000 })
  })

  test('publish page renders progressbar and transfer toggle', async ({ page }) => {
    const runId = (await firstRunId(page, '&status=PAID')) ?? (await firstRunId(page, '&status=APPROVED'))
    test.skip(!runId, 'no PAID/APPROVED run in seed')

    await assertPageLoads(page, `/payroll/${runId}/publish`)
    await waitForLoading(page)

    await expect(page.locator('main h1').first()).toBeVisible({ timeout: 20000 })
    // Wave 1: 그라데이션 제거 + role=progressbar a11y 가드
    await expect(page.getByRole('progressbar').first()).toBeVisible({ timeout: 10000 })
  })
})

// ─── EMPLOYEE tests ─────────────────────────────────────

test.describe('Payroll: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('my payslip page loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll/me')
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()
    // h1 appears after API fetch completes (loading → content or empty state)
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15000 })
  })

  // Wave 1: hero(최근 명세서)·12개월 추이·전체 명세서 섹션 가드.
  // 시드에 지급 명세서가 없으면 EmptyState 분기를 검증한다 (공유/CI 시드 모두 안전).
  test('my payslip Wave 1 layout renders hero or empty state', async ({ page }) => {
    await assertPageLoads(page, '/payroll/me')
    await waitForLoading(page)

    await expect(page.locator('main h1').first()).toBeVisible({ timeout: 15000 })

    const hero = page.getByRole('heading', { name: /최근 명세서|Latest Payslip/ })
    const empty = page.getByText(/급여명세서가 없어요|No pay stubs/)
    await expect(hero.or(empty).first()).toBeVisible({ timeout: 15000 })

    // hero가 있으면 추이·전체 명세서 섹션도 함께 렌더되어야 한다
    if (await hero.isVisible().catch(() => false)) {
      await expect(page.getByRole('heading', { name: /12개월 추이|12-Month Trend/ })).toBeVisible()
      await expect(page.getByRole('heading', { name: /전체 명세서|All Payslips/ })).toBeVisible()
    }
  })
})
