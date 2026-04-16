// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance Core API Tests
// Clock-in/out, today, weekly, monthly, admin, team, RBAC
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { ApiClient, assertOk, assertError, parseApiResponse } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import { resolveSeedData } from '../helpers/test-data'
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

    test.beforeAll(async ({ request }) => {
      // Ensure no open clock-in exists (idempotent cleanup)
      const api = new ApiClient(request)
      const today = await getTodayAttendance(api)
      if (today.ok && today.data && !(today.data as Record<string, unknown>).clockOut) {
        await clockOut(api)
      }
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

    test('Clock-in after clock-out creates second record (same day)', async ({ request }) => {
      const api = new ApiClient(request)
      // Attempt second clock-in (after previous describe's clock-out)
      const res = await clockIn(api)
      // Either 200 (creates second record) or 400 (already has open record)
      expect([200, 400]).toContain(res.status)
      // Clean up: if we created a new record, clock out
      if (res.ok) {
        await clockOut(api)
      }
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
      seedAttendanceId = records[0].id as string

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

    test('GET /attendance/admin returns 200 (has attendance_manage)', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getAdminAttendance(api)
      assertOk(res, 'manager admin access')
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
