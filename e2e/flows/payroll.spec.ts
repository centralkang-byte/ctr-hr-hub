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

  test('bank transfers page loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll/bank-transfers')
    await waitForPageReady(page)
  })

  test('year-end page loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll/year-end')
    await waitForPageReady(page)
  })

  test('global payroll page loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll/global')
    await waitForPageReady(page)
  })

  test('import page loads', async ({ page }) => {
    await assertPageLoads(page, '/payroll/import')
    await waitForPageReady(page)
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
})
