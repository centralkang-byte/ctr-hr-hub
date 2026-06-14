// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance Core API Tests
// Clock-in/out, today, weekly, monthly, admin, team, RBAC
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { ApiClient, assertOk, assertError, parseApiResponse } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import { resolveSeedData } from '../helpers/test-data'
import { deleteAttendanceOn, closeDb } from '../helpers/db'

// KST 오늘 달력 날짜 (CTR = Asia/Seoul)
function kstTodayStr(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
}

// UTC ISO 타임스탬프 → KST 달력 날짜 (YYYY-MM-DD)
function kstDateOf(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10)
}
import {
  clockIn,
  clockOut,
  getTodayAttendance,
  getWeeklySummary,
  getMonthlyAttendance,
  getAdminAttendance,
  getAdminWeekly,
  getAdminRoster,
  getTeamAttendance,
  getAttendanceDetail,
  correctAttendance,
  getEmployeeAttendance,
  listShifts,
} from '../helpers/attendance-fixtures'

test.describe('Attendance Core API', () => {
  // ─── EMPLOYEE: Self-service attendance ────────────────────

  test.describe('EMPLOYEE: Self-service attendance', () => {
    test.describe.configure({ mode: 'serial' })
    test.use({ storageState: authFile('EMPLOYEE') })

    test.beforeAll(async () => {
      // 1일 1레코드 정책(S276): 완료된 기록도 재출근을 막으므로 API 정리(clock-out)만으로는
      // 반복 실행이 불가 → 당일 레코드를 DB에서 직접 삭제 (Codex r2-4)
      await deleteAttendanceOn('employee-a@ctr.co.kr', kstTodayStr())
    })

    test.afterAll(async () => {
      await deleteAttendanceOn('employee-a@ctr.co.kr', kstTodayStr())
      await closeDb()
    })

    test('POST /attendance/clock-in (WEB) creates record', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await clockIn(api, { method: 'WEB' })
      assertOk(res, 'clock-in')
      const data = res.data as Record<string, unknown>
      expect(data.clockIn).toBeTruthy()
    })

    test('POST /attendance/clock-in duplicate returns 400', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await clockIn(api)
      assertError(res, 400, 'duplicate clock-in')
    })

    test('GET /attendance/today returns record with clockIn', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getTodayAttendance(api)
      assertOk(res, 'today')
      const data = res.data as Record<string, unknown>
      expect(data.clockIn).toBeTruthy()
      expect(data.clockOut).toBeFalsy()
    })

    test('POST /attendance/clock-out updates record', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await clockOut(api, { method: 'WEB' })
      assertOk(res, 'clock-out')
      const data = res.data as Record<string, unknown>
      expect(data.clockOut).toBeTruthy()
    })

    test('POST /attendance/clock-out without open record returns 400', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await clockOut(api)
      assertError(res, 400, 'clock-out without open record')
    })

    test('GET /attendance/today shows both clockIn and clockOut', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getTodayAttendance(api)
      // After clock-out, today returns latest record
      expect(res.status).toBe(200)
      if (res.data) {
        const data = res.data as Record<string, unknown>
        expect(data.clockIn).toBeTruthy()
        expect(data.clockOut).toBeTruthy()
      }
    })

    // serial 플로우 내 위치 필수 (S280): Edge cases describe에 있을 땐 fullyParallel
    // 워커가 self-service 플로우와 동시에 employee-a를 clock-in해 409 flake 유발.
    // 퇴근 완료 직후로 옮겨 1일 1레코드(S276) 거부를 결정적으로 검증한다.
    test('Clock-in after clock-out is rejected (one record per day, S276)', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await clockIn(api)
      assertError(res, 400, 'clock-in after completed record')
    })

    test('GET /attendance/weekly-summary returns 200', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getWeeklySummary(api)
      assertOk(res, 'weekly-summary')
      expect(res.data).toBeDefined()
    })

    test('GET /attendance/monthly/2026/4 returns 200', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getMonthlyAttendance(api, 2026, 4)
      assertOk(res, 'monthly')
    })
  })

  // ─── Edge cases ──────────────────────────────────────────

  test.describe('EMPLOYEE: Edge cases', () => {
    test.use({ storageState: authFile('EMPLOYEE') })

    test('GET /attendance/today response shape is valid', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getTodayAttendance(api)
      expect(res.status).toBe(200)
      // data can be null or an attendance object — both are valid
      expect(res.body).toHaveProperty('data')
    })

    test('POST /attendance/clock-in missing method returns 400', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await api.post('/api/v1/attendance/clock-in', {})
      assertError(res, 400, 'missing method')
    })

    test('POST /attendance/clock-in invalid method returns 400', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await api.post('/api/v1/attendance/clock-in', { method: 'INVALID' })
      assertError(res, 400, 'invalid method')
    })
  })

  // ─── HR_ADMIN: Admin attendance management ───────────────

  test.describe('HR_ADMIN: Admin attendance management', () => {
    test.describe.configure({ mode: 'serial' })
    test.use({ storageState: authFile('HR_ADMIN') })

    let seedEmployeeId: string
    let seedAttendanceId: string | undefined

    test.beforeAll(async ({ request }) => {
      const seed = await resolveSeedData(request)
      seedEmployeeId = seed.employeeId
    })

    test('GET /attendance/admin returns 200', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminAttendance(api)
      assertOk(res, 'admin dashboard')
    })

    test('GET /attendance/admin with date filter returns 200', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminAttendance(api, { date: '2026-03-15' })
      assertOk(res, 'admin date filter')
    })

    test('GET /attendance/employees/[id] returns employee history', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getEmployeeAttendance(api, seedEmployeeId)
      // May be 200 with records or 404 if employee not visible to HR_ADMIN
      if (res.status === 404) {
        test.skip(true, 'Employee not visible to HR_ADMIN (different company scope)')
        return
      }
      assertOk(res, 'employee attendance history')
      // Response shape: { records: [...], total: number }
      const data = res.data as Record<string, unknown>
      expect(data.records).toBeDefined()
    })

    test('GET /attendance/[id] returns record detail', async ({ request }) => {
      const api = new ApiClient(request)
      // Find an existing attendance record from employee history
      const histRes = await getEmployeeAttendance(api, seedEmployeeId)
      if (!histRes.ok) {
        test.skip(true, 'Employee history not accessible — skipping detail test')
        return
      }
      // Response: { data: { records: [...], total } }
      const histData = histRes.data as Record<string, unknown>
      const records = (histData.records ?? []) as Array<Record<string, unknown>>
      if (records.length === 0) {
        test.skip(true, 'No seed attendance records available')
        return
      }
      // 공유 시드 직원(employee-a)은 self-service describe가 KST-오늘 기록을
      // 생성/삭제한다. workDate desc라 records[0]가 그 오늘 기록일 수 있는데, 다른
      // 워커의 afterAll 삭제와 겹치면 보정 PUT이 404가 된다. self-service는 오늘만
      // 건드리므로 KST-오늘이 아닌 과거 시드 기록을 골라 경합을 차단한다 (S281).
      const past = records.find((r) => kstDateOf(String(r.workDate)) !== kstTodayStr())
      seedAttendanceId = (past ?? records[0]).id as string

      const res = await getAttendanceDetail(api, seedAttendanceId)
      assertOk(res, 'attendance detail')
      const data = res.data as Record<string, unknown>
      expect(data.id).toBe(seedAttendanceId)
    })

    test('PUT /attendance/[id] correction with note succeeds', async ({ request }) => {
      if (!seedAttendanceId) {
        test.skip(true, 'No attendance record to correct')
        return
      }
      const api = new ApiClient(request)
      const res = await correctAttendance(api, seedAttendanceId, {
        note: 'E2E test correction',
        status: 'NORMAL',
      })
      assertOk(res, 'attendance correction')
    })

    test('PUT /attendance/[id] clock-time correction recomputes overtimeMinutes', async ({ request }) => {
      if (!seedAttendanceId) {
        test.skip(true, 'No attendance record to correct')
        return
      }
      const api = new ApiClient(request)
      // 12h 경과(720분) → 초과근무 = 720 − 60(휴식) − 480(표준) = 180분.
      // 보정이 totalMinutes만 갱신하고 overtimeMinutes는 stale로 두던 Bucket D #9 회귀 가드.
      const res = await correctAttendance(api, seedAttendanceId, {
        note: 'E2E overtime recompute',
        clockIn: '2026-04-01T00:00:00.000Z',
        clockOut: '2026-04-01T12:00:00.000Z',
      })
      assertOk(res, 'overtime recompute correction')
      const updated = res.data as Record<string, unknown>
      expect(updated.totalMinutes).toBe(720)
      expect(updated.overtimeMinutes).toBe(180)
    })

    test('PUT /attendance/[id] correction missing note returns 400', async ({ request }) => {
      if (!seedAttendanceId) {
        test.skip(true, 'No attendance record to correct')
        return
      }
      const api = new ApiClient(request)
      const res = await api.put(`/api/v1/attendance/${seedAttendanceId}`, {
        status: 'LATE',
        // note is required
      })
      assertError(res, 400, 'correction missing note')
    })

    test('GET /attendance/shifts returns 200 with date range', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await listShifts(api, {
        startDate: '2026-04-01',
        endDate: '2026-04-07',
      })
      assertOk(res, 'shifts list')
    })

    test('GET /attendance/shifts missing dates returns 400', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await listShifts(api)
      assertError(res, 400, 'shifts missing dates')
    })
  })

  // ─── MANAGER: Team attendance ────────────────────────────

  test.describe('MANAGER: Team attendance', () => {
    test.use({ storageState: authFile('MANAGER') })

    test('GET /attendance/team returns 200', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getTeamAttendance(api)
      assertOk(res, 'team attendance')
    })

    test('GET /attendance/admin → 403 (S275 deny-by-default: HR/SUPER 전용, MANAGER는 team)', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminAttendance(api)
      assertError(res, 403, 'manager admin access denied')
    })
  })

  // ─── SUPER_ADMIN: Cross-company access ───────────────────

  test.describe('SUPER_ADMIN: Cross-company access', () => {
    test.use({ storageState: authFile('SUPER_ADMIN') })

    test('GET /attendance/admin returns 200', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminAttendance(api)
      assertOk(res, 'super admin attendance')
    })

    test('GET /attendance/admin with companyId filter returns 200', async ({ request }) => {
      const api = new ApiClient(request)
      const seed = await resolveSeedData(request)
      const res = await getAdminAttendance(api, { companyId: seed.companyId })
      assertOk(res, 'super admin cross-company')
    })
  })

  // ─── RBAC: Attendance boundaries ─────────────────────────

  test.describe('RBAC: EMPLOYEE blocked from admin/correction', () => {
    test.use({ storageState: authFile('EMPLOYEE') })

    test('EMPLOYEE blocked from GET /attendance/admin', async ({ request }) => {
      const res = await parseApiResponse(
        await request.get('/api/v1/attendance/admin'),
      )
      assertError(res, 403, 'employee admin block')
    })

    test('EMPLOYEE blocked from PUT /attendance/[id]', async ({ request }) => {
      const fakeId = '00000000-0000-0000-0000-000000000001'
      const res = await parseApiResponse(
        await request.put(`/api/v1/attendance/${fakeId}`, {
          data: { note: 'test', status: 'NORMAL' },
        }),
      )
      assertError(res, 403, 'employee correction block')
    })
  })

  // ─── Weekly matrix (직원 × 7일 + 휴가 오버레이) ───────────────

  test.describe('HR_ADMIN: Weekly attendance matrix', () => {
    test.use({ storageState: authFile('HR_ADMIN') })

    test('GET /attendance/admin/weekly returns 7-day matrix', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminWeekly(api)
      assertOk(res, 'admin weekly')
      const d = res.data as { weekStart: string; days: string[]; rows: unknown[]; nextCursor: string | null }
      expect(d.days).toHaveLength(7)
      expect(d.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(d.days[0]).toBe(d.weekStart)
      expect(Array.isArray(d.rows)).toBe(true)
    })

    test('?start= normalizes to that week Monday (7 consecutive days)', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminWeekly(api, { start: '2026-05-13' })
      assertOk(res, 'admin weekly start')
      const d = res.data as { weekStart: string; days: string[] }
      const [y, m, dd] = d.weekStart.split('-').map(Number)
      expect(new Date(Date.UTC(y, m - 1, dd)).getUTCDay()).toBe(1) // 월요일 정렬
      expect(d.days).toHaveLength(7)
      expect(d.days[0]).toBe(d.weekStart)
      expect(d.days).toContain('2026-05-13')
    })

    test('row cells expose attendance|null + leave|null over 7 days', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminWeekly(api, { limit: '3' })
      assertOk(res, 'weekly cells')
      const d = res.data as { rows: Array<{ cells: Array<{ date: string; attendance: unknown; leave: unknown }> }> }
      if (d.rows.length > 0) {
        const cells = d.rows[0].cells
        expect(cells).toHaveLength(7)
        for (const c of cells) {
          expect(c.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
          expect(c.attendance === null || typeof c.attendance === 'object').toBe(true)
          expect(c.leave === null || typeof c.leave === 'object').toBe(true)
        }
      }
    })

    test('cursor pagination advances without overlap', async ({ request }) => {
      const api = new ApiClient(request)
      const p1 = await getAdminWeekly(api, { limit: '1' })
      assertOk(p1, 'weekly page1')
      const d1 = p1.data as { rows: Array<{ employeeId: string }>; nextCursor: string | null }
      if (d1.nextCursor && d1.rows[0]) {
        const p2 = await getAdminWeekly(api, { limit: '1', cursor: d1.nextCursor })
        assertOk(p2, 'weekly page2')
        const d2 = p2.data as { rows: Array<{ employeeId: string }> }
        if (d2.rows[0]) expect(d2.rows[0].employeeId).not.toBe(d1.rows[0].employeeId)
      }
    })

    test('?start=invalid → 400', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminWeekly(api, { start: '05-13-2026' })
      assertError(res, 400, 'invalid start')
    })

    test('?start=2026-02-31 (non-calendar date) → 400', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminWeekly(api, { start: '2026-02-31' })
      assertError(res, 400, 'non-calendar date')
    })

    test('?cursor=non-uuid → 400 (no 500)', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminWeekly(api, { cursor: 'not-a-uuid' })
      assertError(res, 400, 'invalid cursor')
    })
  })

  test.describe('SUPER_ADMIN: Weekly cross-company', () => {
    test.use({ storageState: authFile('SUPER_ADMIN') })

    test('GET /attendance/admin/weekly?companyId returns 200', async ({ request }) => {
      const api = new ApiClient(request)
      const seed = await resolveSeedData(request)
      const res = await getAdminWeekly(api, { companyId: seed.companyId })
      assertOk(res, 'super weekly cross-company')
    })
  })

  test.describe('MANAGER: Weekly matrix denied', () => {
    test.use({ storageState: authFile('MANAGER') })

    test('GET /attendance/admin/weekly → 403', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminWeekly(api)
      assertError(res, 403, 'manager weekly denied')
    })
  })

  test.describe('EMPLOYEE: Weekly matrix denied', () => {
    test.use({ storageState: authFile('EMPLOYEE') })

    test('GET /attendance/admin/weekly → 403', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminWeekly(api)
      assertError(res, 403, 'employee weekly denied')
    })
  })

  // ─── Roster (today list) ─────────────────────────────────────
  test.describe('HR_ADMIN: Today roster', () => {
    test.use({ storageState: authFile('HR_ADMIN') })

    test('GET /attendance/admin/roster returns date + rows + nextCursor', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminRoster(api)
      assertOk(res, 'admin roster')
      const d = res.data as { date: string; rows: unknown[]; nextCursor: string | null }
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Array.isArray(d.rows)).toBe(true)
      expect(d.nextCursor === null || typeof d.nextCursor === 'string').toBe(true)
    })

    test('row exposes attendance|null + leaves[] (multi-fact)', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminRoster(api, { limit: '5' })
      assertOk(res, 'roster rows')
      const d = res.data as {
        rows: Array<{ employeeId: string; name: string; attendance: unknown; leaves: unknown[] }>
      }
      for (const row of d.rows) {
        expect(typeof row.employeeId).toBe('string')
        expect(row.attendance === null || typeof row.attendance === 'object').toBe(true)
        expect(Array.isArray(row.leaves)).toBe(true) // 단일 객체 아님 — AM/PM 반차 다중 표현
      }
    })

    test('cursor pagination advances without overlap', async ({ request }) => {
      const api = new ApiClient(request)
      const p1 = await getAdminRoster(api, { limit: '1' })
      assertOk(p1, 'roster page1')
      const d1 = p1.data as { rows: Array<{ employeeId: string }>; nextCursor: string | null }
      if (d1.nextCursor && d1.rows[0]) {
        const p2 = await getAdminRoster(api, { limit: '1', cursor: d1.nextCursor })
        assertOk(p2, 'roster page2')
        const d2 = p2.data as { rows: Array<{ employeeId: string }> }
        if (d2.rows[0]) expect(d2.rows[0].employeeId).not.toBe(d1.rows[0].employeeId)
      }
    })

    test('?date=invalid → 400', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminRoster(api, { date: '06-14-2026' })
      assertError(res, 400, 'invalid date')
    })

    test('?date=2026-02-31 (non-calendar) → 400', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminRoster(api, { date: '2026-02-31' })
      assertError(res, 400, 'non-calendar date')
    })

    test('?date=future → 400', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminRoster(api, { date: '2099-01-01' })
      assertError(res, 400, 'future date rejected')
    })

    test('?cursor=non-uuid → 400 (no 500)', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminRoster(api, { cursor: 'not-a-uuid' })
      assertError(res, 400, 'invalid cursor')
    })

    test('?cursor=unknown/foreign employee UUID → 400 (ownership gate)', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminRoster(api, { cursor: '00000000-0000-4000-8000-000000000000' })
      assertError(res, 400, 'cursor not in company set')
    })

    test('HR passing another companyId is ignored (resolveCompanyId forces own) → 200', async ({ request }) => {
      const api = new ApiClient(request)
      // 비-SUPER는 companyId 파라미터 무시 — 자기 법인 roster 반환(타 법인 누출 없음)
      const res = await getAdminRoster(api, { companyId: '00000000-0000-4000-8000-000000000000' })
      assertOk(res, 'hr foreign companyId ignored')
    })
  })

  test.describe('SUPER_ADMIN: Roster cross-company', () => {
    test.use({ storageState: authFile('SUPER_ADMIN') })

    test('GET /attendance/admin/roster?companyId returns 200', async ({ request }) => {
      const api = new ApiClient(request)
      const seed = await resolveSeedData(request)
      const res = await getAdminRoster(api, { companyId: seed.companyId })
      assertOk(res, 'super roster cross-company')
    })
  })

  test.describe('MANAGER: Roster denied', () => {
    test.use({ storageState: authFile('MANAGER') })

    test('GET /attendance/admin/roster → 403', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminRoster(api)
      assertError(res, 403, 'manager roster denied')
    })
  })

  test.describe('EMPLOYEE: Roster denied', () => {
    test.use({ storageState: authFile('EMPLOYEE') })

    test('GET /attendance/admin/roster → 403', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminRoster(api)
      assertError(res, 403, 'employee roster denied')
    })
  })
})
