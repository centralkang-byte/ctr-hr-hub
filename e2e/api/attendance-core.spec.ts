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
})
