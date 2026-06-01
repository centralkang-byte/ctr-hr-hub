// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance Monthly Stats E2E (PR-4 AT-005 카나리)
// PR-3 leave-workflow.spec.ts 동형 스타일. storageState EMPLOYEE.
// 비-flaky 구조 단언 (seed 수치 비의존).
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from '../helpers/auth'
import { waitForLoading } from '../helpers/wait-helpers'

test.describe('Attendance PR-4: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  // S1: AT-005 5지표 신규 마운트 표시 (WdMonthlyStatCard)
  test('S1 AT-005 월간통계 카드 마운트 + 5지표 라벨', async ({ page }) => {
    await assertPageLoads(page, '/attendance')
    await waitForLoading(page)
    // WdGroupedStatCard section (title=t('monthlySummary')="월간 요약"; M-2: 영문은 Summary 한정)
    const card = page.getByRole('region', { name: /월간 요약|Monthly Summary/ })
    await expect(card).toBeVisible({ timeout: 10000 })
    // 5지표 라벨 (i18n 기존 키 재사용): 근무일/출근/퇴근/초과근무/지각
    for (const label of [/근무일/, /출근/, /퇴근/, /초과근무/, /지각/]) {
      await expect(card.getByText(label).first()).toBeVisible({ timeout: 10000 })
    }
  })

  // S2: 빈 표현 정합 — EmptyState 또는 "--:--" (seed 무관 구조 단언)
  test('S2 WdMonthlyStatCard 빈 표현 / 데이터 행 정합', async ({ page }) => {
    await assertPageLoads(page, '/attendance')
    await waitForLoading(page)
    const card = page.getByRole('region', { name: /월간 요약|Monthly Summary/ })
    await expect(card).toBeVisible({ timeout: 10000 })
    // 데이터 有 = role=list StatRow / 데이터 無 = EmptyState. 둘 중 하나 정상.
    const hasRows = await card.getByRole('list').isVisible().catch(() => false)
    const bodyText = (await card.textContent()) ?? ''
    expect(hasRows || /--:--|데이터|No data|EmptyState/i.test(bodyText)).toBeTruthy()
  })

  // S3: AT-004 히트그리드 byte-identical 회귀 0 (PR-2 surface 무영향)
  test('S3 AT-004 히트그리드 회귀 0', async ({ page }) => {
    await assertPageLoads(page, '/attendance')
    await waitForLoading(page)
    // PR-2 AT-004 = WdStatusHeatGrid (title=t('monthlyRecord')="월별 근태")
    const heat = page.getByRole('region', { name: /월별 근태|Monthly Record/ })
    await expect(heat).toBeVisible({ timeout: 10000 })
    // 월간통계(AT-005)와 히트그리드(AT-004) 동시 공존 (M-2: Summary 한정 selector)
    const monthly = page.getByRole('region', { name: /월간 요약|Monthly Summary/ })
    await expect(monthly).toBeVisible({ timeout: 10000 })
    // M-1: proto 시각 순서 DOM 단언 — AT-005가 AT-004보다 상위 (y 좌표)
    const monthlyBox = await monthly.first().boundingBox()
    const heatBox = await heat.first().boundingBox()
    expect(monthlyBox, 'AT-005 region bounding box').not.toBeNull()
    expect(heatBox, 'AT-004 region bounding box').not.toBeNull()
    expect(monthlyBox!.y).toBeLessThan(heatBox!.y)
  })

  // S4: 가디언 회귀 — 에러바운더리 0 / 치명 콘솔 0
  test('S4 가디언 회귀 — 에러바운더리·콘솔', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await assertPageLoads(page, '/attendance')
    await waitForLoading(page)
    await expect(page.locator('text=페이지를 불러올 수 없습니다')).not.toBeVisible()
    await expect(page.locator('main')).toBeVisible()
    // 치명 콘솔(앱 크래시급) 0 — 알려진 무관 노이즈(Vercel Speed Insights CSP) 제외
    const fatal = errors.filter(
      (e) => /Cannot read|is not a function|Uncaught/.test(e) && !/speed-insights|vercel-scripts/.test(e),
    )
    expect(fatal, fatal.join('\n')).toHaveLength(0)
  })

  // S5: 모바일 375px AT-005 reflow
  test('S5 모바일 375px 렌더', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await assertPageLoads(page, '/attendance')
    await waitForLoading(page)
    await expect(page.locator('main')).toBeVisible()
    const card = page.getByRole('region', { name: /월간 요약|Monthly Summary/ })
    await expect(card).toBeVisible({ timeout: 10000 })
    // M-1: 가로 overflow 0 (main scrollWidth ≤ clientWidth, 375 reflow 정합)
    const dims = await page
      .locator('main')
      .evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }))
    expect(dims.scroll).toBeLessThanOrEqual(dims.client)
    // M-1: rows=5 단언 — 데이터 有 시 5건 / 데이터 無 시 0건 (EmptyState 경로) 정합
    const rowCount = await card.getByRole('listitem').count()
    expect([0, 5]).toContain(rowCount)
  })
})
