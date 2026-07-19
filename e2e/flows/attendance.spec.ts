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

function shiftWallTime(wallTime: string, minutes: number): string {
  const shifted = new Date(`${wallTime}:00.000Z`)
  shifted.setUTCMinutes(shifted.getUTCMinutes() + minutes)
  return shifted.toISOString().slice(0, 16)
}

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
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let recordId = ''
  let originalClockIn: string | null = null
  let originalClockOut: string | null = null
  let originalWorkType = 'NORMAL'

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
    const record = today.data as {
      id?: string
      clockIn?: string | null
      clockOut?: string | null
      workType?: string
    } | null
    recordId = record?.id ?? ''
    originalClockIn = record?.clockIn ?? null
    originalClockOut = record?.clockOut ?? null
    originalWorkType = record?.workType ?? 'NORMAL'
    expect(recordId, 'setup: employee-a 오늘 근태 레코드 확보 실패').toBeTruthy()

    // HR_ADMIN으로 LATE 보정 → 오늘 anomaly 테이블에 확정 노출
    const hrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    const hrApi = new ApiClient(hrReq)
    const pending = await hrApi.get<Array<{
      id: string
      referenceId: string | null
      status: string
    }>>('/api/v1/approvals/attendance', {
      view: 'team',
      requestType: 'attendance_correction',
      status: 'pending',
      limit: '100',
    })
    expect(pending.ok, 'setup: pending correction 조회 실패').toBe(true)
    for (const request of pending.data ?? []) {
      if (request.referenceId !== recordId) continue
      const claim = await hrApi.put(`/api/v1/approvals/attendance/${request.id}`, {
        action: 'claim',
      })
      expect(claim.ok, 'setup: stale pending correction claim 실패').toBe(true)
      const reject = await hrApi.put(`/api/v1/approvals/attendance/${request.id}`, {
        action: 'reject',
        comment: 'E2E browser flow pre-cleanup',
      })
      expect(reject.ok, 'setup: stale pending correction reject 실패').toBe(true)
    }

    const res = await correctAttendance(hrApi, recordId, {
      note: 'E2E drawer canary setup',
      status: 'LATE',
    })
    await hrReq.dispose()
    expect(res.ok, `setup: LATE 보정 실패 (status ${res.status})`).toBe(true)
  })

  test.afterAll(async () => {
    // pending 요청을 먼저 정리한 뒤 원래 시각을 복구 — 다음 실행·다른 spec 오염 방지
    if (!recordId) return
    const hrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    const hrApi = new ApiClient(hrReq)
    const pending = await hrApi.get<Array<{ id: string; referenceId: string | null }>>(
      '/api/v1/approvals/attendance',
      {
        view: 'team',
        requestType: 'attendance_correction',
        status: 'pending',
        limit: '100',
      },
    )
    for (const request of pending.data ?? []) {
      if (request.referenceId !== recordId) continue
      await hrApi.put(`/api/v1/approvals/attendance/${request.id}`, { action: 'claim' })
      await hrApi.put(`/api/v1/approvals/attendance/${request.id}`, {
        action: 'reject',
        comment: 'E2E browser flow cleanup',
      })
    }
    await hrApi.put(`/api/v1/attendance/${recordId}`, {
      note: 'E2E drawer canary cleanup',
      clockIn: originalClockIn,
      clockOut: originalClockOut,
      workType: originalWorkType,
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

  test('employee request is reviewed by HR and reflected in the employee record', async ({ page, browser }) => {
    const baseURL = test.info().project.use.baseURL
    expect(baseURL, 'browser project baseURL is required').toBeTruthy()
    const employeeContext = await browser.newContext({
      storageState: authFile('EMPLOYEE'),
      baseURL: String(baseURL),
      viewport: { width: 390, height: 844 },
    })
    const employeePage = await employeeContext.newPage()

    try {
      await assertPageLoads(employeePage, '/attendance')
      await waitForPageReady(employeePage)

      const requestButton = employeePage
        .getByRole('button', { name: /보정 신청|Request Correction/i })
        .first()
      await expect(requestButton).toBeVisible({ timeout: 15000 })
      expect((await requestButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
      await requestButton.click()

      const drawer = employeePage
        .locator('[role="dialog"]')
        .filter({ has: employeePage.locator('#attendance-correction-reason') })
      await expect(drawer).toBeVisible({ timeout: 10000 })
      const clockInInput = drawer.locator('#attendance-correction-clock-in')
      const originalWallTime = await clockInInput.inputValue()
      expect(originalWallTime, 'employee correction requires an existing clock-in').toBeTruthy()
      const requestedWallTime = shiftWallTime(originalWallTime, -1)
      await clockInInput.fill(requestedWallTime)
      await drawer.locator('#attendance-correction-reason').fill(`E2E employee-to-HR ${Date.now()}`)

      const submitButton = drawer.getByRole('button', { name: /^제출$|^Submit$/i })
      expect((await submitButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
      const [submitResponse] = await Promise.all([
        employeePage.waitForResponse((response) =>
          response.request().method() === 'POST' &&
          response.url().includes(`/api/v1/attendance/${recordId}/correction-requests`),
        ),
        submitButton.click(),
      ])
      expect(submitResponse.status()).toBe(201)
      const created = await submitResponse.json() as {
        data: {
          id: string
          referenceId: string
          title: string
          details: { workDate: string }
        }
      }
      const correctionRequestId = created.data.id
      expect(created.data.referenceId).toBe(recordId)
      await expect(drawer).toBeHidden({ timeout: 10000 })

      await assertPageLoads(
        employeePage,
        '/approvals/attendance?view=mine&requestType=attendance_correction&status=pending',
      )
      await expect(employeePage.getByText(created.data.title, { exact: true })).toBeVisible({ timeout: 15000 })

      await assertPageLoads(
        page,
        '/approvals/attendance?view=team&requestType=attendance_correction&status=pending',
      )
      await waitForPageReady(page)
      await page.getByText(created.data.title, { exact: true }).click()
      await expect(page.locator('[data-correction-state="ready"]')).toBeVisible({ timeout: 15000 })
      await expect(page.getByText(/이전|Previous/i).first()).toBeVisible()
      await expect(page.getByText(/보정 신청|Request Correction/i).first()).toBeVisible()

      const [approveResponse] = await Promise.all([
        page.waitForResponse((response) =>
          response.request().method() === 'PUT' &&
          response.url().includes(`/api/v1/approvals/attendance/${correctionRequestId}`),
        ),
        page.getByRole('button', { name: /^승인$|^Approve$/i }).click(),
      ])
      expect(approveResponse.ok()).toBeTruthy()

      await assertPageLoads(employeePage, '/attendance')
      await waitForPageReady(employeePage)
      const updatedRow = employeePage
        .locator('li', { hasText: created.data.details.workDate })
        .first()
      await expect(updatedRow).toBeVisible({ timeout: 15000 })
      await expect(updatedRow).toContainText(requestedWallTime.slice(11))
    } finally {
      await employeeContext.close()
    }
  })
})
