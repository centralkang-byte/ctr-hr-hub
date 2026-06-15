// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employees BulkActionBar E2E (Wave 1 IA, 카나리 N2)
// 직원 목록 행선택 → 하단 BulkActionBar → 선택 내보내기(ids).
// N1: 엑셀 내보내기(선택) = (나) — export 라우트 ids ANDed 회사스코프.
// 메시지·일괄발령은 백엔드 부재로 미노출(후속 피처).
// 역할: /employees = HR_UP 전용 → 비-HR은 리다이렉트(접근 차단).
// gstack 라이브(시각) ≠ E2E(자동화) — 본 파일은 자동화 검증.
// ═══════════════════════════════════════════════════════════

import { test, expect, type Page } from '@playwright/test'
import { authFile, assertBlocked } from '../helpers/auth'
import { waitForLoading, waitForPageReady } from '../helpers/wait-helpers'

const EMPLOYEES_URL = '/employees'

// BulkActionBar 시그니처: 하단 중앙 fixed pill (bottom-6, z-40).
function bulkBar(page: Page) {
  return page.locator('div.fixed.bottom-6').first()
}

async function gotoEmployees(page: Page) {
  await page.goto(EMPLOYEES_URL)
  await waitForPageReady(page)
  await waitForLoading(page)
}

// ─── HR_ADMIN: 선택 → 바 → 선택 내보내기 end-to-end ──────────
test.describe('Employees BulkActionBar — HR_ADMIN 선택 내보내기', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('행 선택 → 바 노출 → 선택 내보내기(ids 요청) → 해제 → 바 소멸', async ({
    page,
  }) => {
    await gotoEmployees(page)
    await expect(page.locator('main')).toBeVisible()

    // 선택 전 바 미노출 (count=0 → null)
    await expect(bulkBar(page)).toBeHidden()

    // 헤더 전체선택 체크박스 (Radix role=checkbox, aria-label "전체 선택")
    const selectAll = page
      .getByRole('checkbox', { name: /전체 선택|select all/i })
      .first()
    test.skip(
      !(await selectAll.isVisible().catch(() => false)),
      '직원 행 없음 (seed 의존) — 선택 단계 skip',
    )
    await selectAll.click()

    // 바 노출 + 선택 카운트 + 선택 내보내기 액션
    const bar = bulkBar(page)
    await expect(bar).toBeVisible({ timeout: 5000 })
    await expect(bar).toContainText(/\d+\s*명 선택됨|\d+\s*selected/i)
    const exportBtn = bar.getByRole('button', {
      name: /선택 내보내기|export selected/i,
    })
    await expect(exportBtn).toBeVisible()

    // 선택 내보내기 → /export?ids= 다운로드 (선택→export 배선 검증, 회사스코프 AND)
    // 구현은 <a download href=.../export?ids=> 클릭 → 브라우저 다운로드.
    // Playwright는 이를 'download' 이벤트로 surface (request 이벤트로는 안 잡힘) →
    // waitForRequest 가 아니라 waitForEvent('download') 로 검증.
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      exportBtn.click(),
    ])
    expect(download.url()).toContain('/api/v1/employees/export')
    expect(download.url()).toContain('ids=')

    // 선택 해제 → 바 소멸 (⑦ 상태 갱신)
    const clearBtn = bar.getByRole('button', {
      name: /선택 해제|clear selection/i,
    })
    await clearBtn.click()
    await expect(bulkBar(page)).toBeHidden()
  })
})

// ─── 역할 게이트: 비-HR은 /employees 접근 차단 ───────────────
test.describe('Employees — 역할 게이트 (비-HR 차단)', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('EMPLOYEE는 /employees 접근 시 리다이렉트(바·선택 비노출)', async ({
    page,
  }) => {
    // /employees = HR_UP 전용 라우트 → EMPLOYEE는 페이지 진입 불가(리다이렉트)
    await assertBlocked(page, '/employees')
  })
})
