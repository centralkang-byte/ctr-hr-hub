// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance E2E Tests
// Uses storageState for session reuse.
// ═══════════════════════════════════════════════════════════

import { test, expect, request as playwrightRequest } from '@playwright/test'
import { authFile, assertPageLoads } from '../helpers/auth'
import { waitForLoading, waitForPageReady } from '../helpers/wait-helpers'
import { ApiClient } from '../helpers/api-client'
import { clockIn, getTodayAttendance, correctAttendance } from '../helpers/attendance-fixtures'
import { TEST_ACCOUNTS } from '../helpers/test-data'

// ─── EMPLOYEE tests ──────────────────────────────────────

test.describe('Attendance: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('can view attendance page', async ({ page }) => {
    await assertPageLoads(page, '/attendance')
    await waitForPageReady(page)
  })

  test('can see attendance action area', async ({ page }) => {
    await assertPageLoads(page, '/attendance')
    await waitForPageReady(page)

    // Depending on clock state, shows clock-in button, clock-out button, or completed status
    const clockInBtn = page.getByRole('button', { name: /출근|Clock In/i }).first()
    const clockOutBtn = page.getByRole('button', { name: /퇴근|Clock Out/i }).first()
    const completedBadge = page.getByText(/퇴근 완료|근무 완료|Completed/i).first()
    await expect(clockInBtn.or(clockOutBtn).or(completedBadge)).toBeVisible({ timeout: 15000 })
  })
})

// ─── HR_ADMIN tests ──────────────────────────────────────

test.describe('Attendance: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('can view attendance admin', async ({ page }) => {
    await assertPageLoads(page, '/attendance/admin')
    await waitForPageReady(page)

    const main = page.locator('main')
    await expect(main).toBeVisible({ timeout: 10000 })
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  test('can view shift calendar', async ({ page }) => {
    await assertPageLoads(page, '/attendance/shift-calendar')
    await waitForPageReady(page)

    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  test('can view shift roster', async ({ page }) => {
    await assertPageLoads(page, '/attendance/shift-roster')
    await waitForPageReady(page)

    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  test('can access close-attendance page', async ({ page }) => {
    await assertPageLoads(page, '/payroll/close-attendance')
    await waitForLoading(page)

    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })
})

// ─── HR_ADMIN: correction drawer (WdDrawer 카나리) ────────
// 보정 폼이 중앙 Dialog → 우측 WdDrawer로 전환된 뒤의 UI 플로우 가드.
// API 레벨(성공·400·403·overtime 재계산)은 e2e/api/attendance-core.spec.ts가 커버.

test.describe('Attendance: HR_ADMIN correction drawer', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  let recordId = ''

  test.beforeAll(async () => {
    // employee-a 오늘 근태 레코드 확보 (없으면 clock-in으로 생성).
    // setup 실패 = 명시적 fail — skip으로 가리면 카나리 가드가 false-green이 된다.
    const empReq = await playwrightRequest.newContext({ storageState: authFile('EMPLOYEE') })
    const empApi = new ApiClient(empReq)
    let today = await getTodayAttendance(empApi)
    if (!today.data) {
      await clockIn(empApi) // 이미 처리된 상태 등으로 실패해도 무방 — 아래 재조회로 판정
      today = await getTodayAttendance(empApi)
    }
    await empReq.dispose()
    recordId = (today.data as { id?: string } | null)?.id ?? ''
    expect(recordId, 'setup: employee-a 오늘 근태 레코드 확보 실패').toBeTruthy()

    // HR_ADMIN으로 LATE 보정 → 오늘 anomaly 테이블에 확정 노출
    const hrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    const res = await correctAttendance(new ApiClient(hrReq), recordId, {
      note: 'E2E drawer canary setup',
      status: 'LATE',
    })
    await hrReq.dispose()
    expect(res.ok, `setup: LATE 보정 실패 (status ${res.status})`).toBe(true)
  })

  test.afterAll(async () => {
    // 상태 원복 — 다음 실행·다른 spec 오염 방지 (note는 zod 필수라 cleanup 마커 기록)
    if (!recordId) return
    const hrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    await correctAttendance(new ApiClient(hrReq), recordId, {
      note: 'E2E drawer canary cleanup',
      status: 'NORMAL',
    })
    await hrReq.dispose()
  })

  test('row click opens drawer, note gates save, correction persists', async ({ page }) => {
    await assertPageLoads(page, '/attendance/admin')
    await waitForPageReady(page)

    // anomaly 테이블에서 employee-a 행 클릭
    const row = page.locator('tr', { hasText: TEST_ACCOUNTS.EMPLOYEE_A.name }).first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.click()

    // 우측 드로어 (Radix Sheet = role dialog)
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible({ timeout: 10000 })
    await expect(drawer).toContainText(/근태 보정|Attendance Correction/)

    // 보정 사유 비어 있으면 저장 비활성
    const saveBtn = drawer.getByRole('button', { name: /저장|Save/ })
    await expect(saveBtn).toBeDisabled()

    const note = `E2E 드로어 보정 ${Date.now()}`
    await drawer.locator('#correction-note').fill(note)
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click()

    // 성공 토스트 + 드로어 닫힘
    await expect(page.getByText('저장되었습니다').first()).toBeVisible({ timeout: 10000 })
    await expect(drawer).toBeHidden({ timeout: 10000 })

    // 실데이터 갱신 검증 — note 영속화 (page.request = HR_ADMIN 세션)
    const detail = await new ApiClient(page.request).get(`/api/v1/attendance/${recordId}`)
    expect(detail.ok).toBe(true)
    expect((detail.data as { note?: string | null })?.note).toBe(note)
  })
})
