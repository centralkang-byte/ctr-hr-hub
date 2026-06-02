// ═══════════════════════════════════════════════════════════
// CTR HR Hub — BulkActionBar E2E (Phase 2 P1-7, N2)
// 카나리: shared/approval/BulkApproveBar (BulkActionBar 리스킨)
//         @ /my/tasks?tab=approvals (ApprovalTabContent).
// 액션: 일괄 승인 (N1 (가) 완전 존재 → 연결만).
// gstack 라이브(시각) ≠ E2E(자동화) — 본 파일은 자동화 검증.
// ═══════════════════════════════════════════════════════════

import { test, expect, type Page } from '@playwright/test'
import { authFile } from '../helpers/auth'
import { waitForLoading, waitForPageReady } from '../helpers/wait-helpers'

const APPROVALS_URL = '/my/tasks?tab=approvals'

// BulkActionBar 시그니처: 하단 중앙 fixed pill (bottom-6, z-40).
function bulkBar(page: Page) {
  return page.locator('div.fixed.bottom-6').first()
}

async function gotoApprovals(page: Page) {
  await page.goto(APPROVALS_URL)
  await waitForPageReady(page)
  await waitForLoading(page)
}

// ─── HR_ADMIN: 일괄 승인 end-to-end ──────────────────────────
test.describe('BulkActionBar — HR_ADMIN 일괄 승인', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('행 선택 → 바 노출 → 일괄 승인 모달 z-order → 실결과(목록 갱신·바 소멸)', async ({
    page,
  }) => {
    await gotoApprovals(page)
    await expect(page.locator('main')).toBeVisible()

    // 선택 가능한 승인 항목(체크박스). seed에 pending 없으면 skip.
    const checkboxes = page.locator(
      'input[type="checkbox"], [role="checkbox"], button[aria-label="선택"], button[aria-label="Select"]',
    )
    const cbCount = await checkboxes.count().catch(() => 0)
    test.skip(cbCount === 0, 'pending 승인 항목 없음 (seed 의존) — 액션 단계 skip')

    // 바는 선택 전 미노출 (count=0 → null)
    await expect(bulkBar(page)).toBeHidden()

    // 첫 항목 선택 (전체 선택 버튼 우선, 없으면 첫 체크박스)
    const selectAll = page
      .getByRole('button', { name: /전체 선택|Select All/i })
      .first()
    if (await selectAll.isVisible().catch(() => false)) {
      await selectAll.click()
    } else {
      await checkboxes.first().click()
    }

    // 바 노출 + count + 일괄 승인 액션 + close
    const bar = bulkBar(page)
    await expect(bar).toBeVisible({ timeout: 5000 })
    await expect(bar).toContainText(/\d+\s*건 선택|\d+\s*selected/i)
    const approveBtn = bar.getByRole('button', {
      name: /일괄 승인|bulk approve/i,
    })
    await expect(approveBtn).toBeVisible()

    // 일괄 승인 → confirm 모달. z-order 회귀 가드(Codex P2):
    // 모달 오버레이(z-50) > 바(z-40).
    await approveBtn.click()
    const modal = page.locator('.fixed.inset-0.z-50').first()
    await expect(modal).toBeVisible({ timeout: 5000 })
    const barZ = await bar.evaluate((el) =>
      parseInt(getComputedStyle(el).zIndex || '0', 10),
    )
    const modalZ = await modal.evaluate((el) =>
      parseInt(getComputedStyle(el).zIndex || '0', 10),
    )
    expect(barZ).toBeLessThan(modalZ) // 바가 모달 아래

    // 확인 → 실결과: 모달 닫힘 + 선택 해제(바 소멸) + 목록 refetch
    const confirmBtn = modal.getByRole('button', {
      name: /일괄 승인|승인|confirm|approve/i,
    })
    await confirmBtn.first().click()
    await expect(bulkBar(page)).toBeHidden({ timeout: 10000 })
  })

  test('선택 해제(close) → 바 소멸', async ({ page }) => {
    await gotoApprovals(page)
    const checkboxes = page.locator(
      'input[type="checkbox"], [role="checkbox"], button[aria-label="선택"], button[aria-label="Select"]',
    )
    const cbCount = await checkboxes.count().catch(() => 0)
    test.skip(cbCount === 0, 'pending 승인 항목 없음 — skip')

    const selectAll = page
      .getByRole('button', { name: /전체 선택|Select All/i })
      .first()
    if (await selectAll.isVisible().catch(() => false)) {
      await selectAll.click()
    } else {
      await checkboxes.first().click()
    }

    const bar = bulkBar(page)
    await expect(bar).toBeVisible({ timeout: 5000 })

    const clearBtn = bar.getByRole('button', {
      name: /선택 해제|clear selection/i,
    })
    await clearBtn.click()
    await expect(bulkBar(page)).toBeHidden({ timeout: 5000 })
  })
})

// ─── EMPLOYEE: 일괄 액션 권한 없음 → 바 비가시 ────────────────
test.describe('BulkActionBar — EMPLOYEE 비가시', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('EMPLOYEE 승인 탭에 BulkActionBar 미노출', async ({ page }) => {
    await gotoApprovals(page)
    await expect(page.locator('main')).toBeVisible()
    // EMPLOYEE는 승인 권한 없음 → 선택할 승인 항목/일괄바 없음
    await expect(bulkBar(page)).toBeHidden()
  })
})
