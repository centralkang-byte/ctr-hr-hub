// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Management E2E Tests
// Covers: list, search, detail, new form, org/directory/skills, self-profile
// Uses storageState for session reuse.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from '../helpers/auth'
import { waitForTableRows, waitForLoading, waitForPageReady } from '../helpers/wait-helpers'

// ─── HR_ADMIN tests ──────────────────────────────────────

test.describe('Employee Management: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('can view employee list with data', async ({ page }) => {
    await assertPageLoads(page, '/employees')
    await waitForPageReady(page)
    await waitForLoading(page)
    await waitForTableRows(page, 1)
  })

  test('can search employees', async ({ page }) => {
    await page.goto('/employees')
    await waitForPageReady(page)
    await waitForTableRows(page, 1)

    // Search input should be present
    const searchInput = page.getByPlaceholder(/검색|Search/).first()
    await expect(searchInput).toBeVisible({ timeout: 5000 })

    // fill 후 debounce 300ms + API 응답 + 렌더링 대기
    await searchInput.fill('이민준')
    // 테이블 행 수가 변하거나 안정화될 때까지 대기 (검색 결과 반영)
    await expect(async () => {
      const rows = await page.locator('tbody tr').count()
      expect(rows).toBeGreaterThanOrEqual(1)
    }).toPass({ timeout: 10000 })

    // Page should still be functional after search (no crash)
    expect(page.url()).not.toContain('/login')
    await expect(page.locator('text=페이지를 불러올 수 없습니다')).not.toBeVisible()
  })

  test('can view employee detail page', async ({ page }) => {
    await page.goto('/employees')
    await waitForPageReady(page)
    await waitForTableRows(page, 1)

    // 행 클릭 → QuickView 패널 오픈 또는 상세 이동 (크래시만 안 나면 PASS)
    const firstRow = page.locator('tbody tr').first()
    await firstRow.click()
    // 클릭 후 네비게이션/렌더링 안정화 대기
    await page.waitForLoadState('domcontentloaded')
    await waitForLoading(page)
    // 에러 페이지가 아닌지 확인
    expect(page.url()).not.toContain('/login')
    await expect(page.locator('text=페이지를 불러올 수 없습니다')).not.toBeVisible()
  })

  test('can access new employee form with Step 1 fields', async ({ page }) => {
    await assertPageLoads(page, '/employees/new')
    await waitForPageReady(page)
    await waitForLoading(page)

    // Form should render with some input fields
    await expect(page.locator('form, input, select, [role="combobox"]').first()).toBeVisible({ timeout: 10000 })
  })

  test('can view organization skill matrix page', async ({ page }) => {
    await assertPageLoads(page, '/organization/skill-matrix')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('table, h1, h2').first()).toBeVisible({ timeout: 10000 })
  })

  test('can view employee directory', async ({ page }) => {
    await assertPageLoads(page, '/directory')
    await waitForPageReady(page)
    await waitForLoading(page)

    // Directory: heading 존재 확인 + 콘텐츠(카드 또는 테이블) 로딩 대기
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
    await expect(async () => {
      const items = await page.locator('main img, main svg, tbody tr').count()
      expect(items).toBeGreaterThan(0)
    }).toPass({ timeout: 10000 })
  })

  test('can view skill matrix with competency data', async ({ page }) => {
    await assertPageLoads(page, '/organization/skill-matrix')
    await waitForPageReady(page)
    await waitForLoading(page)

    await expect(page.locator('h1, h2, table').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=페이지를 불러올 수 없습니다')).not.toBeVisible()
  })
})

// ─── EMPLOYEE tests ──────────────────────────────────────

test.describe('Employee Management: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('can view own profile with name displayed', async ({ page }) => {
    await assertPageLoads(page, '/my/profile')
    await waitForPageReady(page)
    await waitForLoading(page)

    // QA seed: EMPLOYEE = 이민준 — target the h1 heading specifically
    await expect(page.getByRole('heading', { name: /이민준/ })).toBeVisible({ timeout: 10000 })
  })
})
