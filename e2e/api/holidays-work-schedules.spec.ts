// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Holidays & Work Schedules API Tests
// CRUD lifecycle, SUPER_ADMIN cross-company, RBAC boundaries
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { ApiClient, assertOk, assertError, parseApiResponse } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import { resolveSeedData } from '../helpers/test-data'
import {
  listHolidays,
  getHoliday,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  listWorkSchedules,
  getWorkSchedule,
  createWorkSchedule,
  updateWorkSchedule,
  deleteWorkSchedule,
  buildStandardDailyConfig,
  futureHolidayDate,
} from '../helpers/attendance-fixtures'

test.describe('Holidays & Work Schedules API', () => {
  // ─── HR_ADMIN: Holiday CRUD ──────────────────────────────

  test.describe('HR_ADMIN: Holiday CRUD', () => {
    test.describe.configure({ mode: 'serial' })
    test.use({ storageState: authFile('HR_ADMIN') })

    const createdHolidayIds: string[] = []

    test.afterAll(async ({ request }) => {
      const api = new ApiClient(request)
      for (const id of createdHolidayIds) {
        await deleteHoliday(api, id).catch(() => {})
      }
    })

    test('GET /holidays returns paginated list', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await listHolidays(api, { year: '2026' })
      assertOk(res, 'holidays list')
      expect(res.pagination).toBeDefined()
    })

    test('GET /holidays with year filter returns 200', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await listHolidays(api, { year: '2026' })
      assertOk(res, 'holidays year filter')
    })

    test('POST /holidays creates holiday', async ({ request }) => {
      const api = new ApiClient(request)
      const name = `e2e-holiday-${Date.now()}`
      const res = await createHoliday(api, {
        name,
        date: futureHolidayDate(0),
        year: 2028,
      })
      assertOk(res, 'create holiday')
      const data = res.data as Record<string, unknown>
      expect(data.name).toBe(name)
      createdHolidayIds.push(data.id as string)
    })

    test('POST /holidays missing name returns 400', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await api.post('/api/v1/holidays', {
        date: futureHolidayDate(1),
        year: 2028,
      })
      assertError(res, 400, 'holiday missing name')
    })

    test('POST /holidays invalid date returns 400', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await createHoliday(api, {
        name: `e2e-bad-date-${Date.now()}`,
        date: 'not-a-date',
        year: 2028,
      })
      assertError(res, 400, 'holiday invalid date')
    })

    test('GET /holidays/[id] returns detail (uncached)', async ({ request }) => {
      const api = new ApiClient(request)
      expect(createdHolidayIds.length).toBeGreaterThan(0)
      const res = await getHoliday(api, createdHolidayIds[0])
      assertOk(res, 'holiday detail')
      const data = res.data as Record<string, unknown>
      expect(data.id).toBe(createdHolidayIds[0])
    })

    test('PUT /holidays/[id] updates name', async ({ request }) => {
      const api = new ApiClient(request)
      const updatedName = `e2e-holiday-updated-${Date.now()}`
      const res = await updateHoliday(api, createdHolidayIds[0], { name: updatedName })
      assertOk(res, 'update holiday')
      const data = res.data as Record<string, unknown>
      expect(data.name).toBe(updatedName)
    })

    test('DELETE /holidays/[id] deletes holiday', async ({ request }) => {
      const api = new ApiClient(request)
      // Create a temporary holiday just for deletion test
      const tempRes = await createHoliday(api, {
        name: `e2e-holiday-delete-${Date.now()}`,
        date: futureHolidayDate(10),
        year: 2028,
      })
      assertOk(tempRes, 'create temp for delete')
      const tempId = (tempRes.data as Record<string, unknown>).id as string

      const delRes = await deleteHoliday(api, tempId)
      assertOk(delRes, 'delete holiday')

      // Verify deleted via detail endpoint (not cached list)
      const getRes = await getHoliday(api, tempId)
      assertError(getRes, 404, 'holiday not found after delete')
    })

    test('POST /holidays with isSubstitute=true', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await createHoliday(api, {
        name: `e2e-substitute-${Date.now()}`,
        date: futureHolidayDate(20),
        year: 2028,
        isSubstitute: true,
      })
      assertOk(res, 'substitute holiday')
      const data = res.data as Record<string, unknown>
      expect(data.isSubstitute).toBe(true)
      createdHolidayIds.push(data.id as string)
    })
  })

  // ─── HR_ADMIN: Work Schedule CRUD ────────────────────────

  test.describe('HR_ADMIN: Work Schedule CRUD', () => {
    test.describe.configure({ mode: 'serial' })
    test.use({ storageState: authFile('HR_ADMIN') })

    const createdScheduleIds: string[] = []

    test.afterAll(async ({ request }) => {
      const api = new ApiClient(request)
      for (const id of createdScheduleIds) {
        await deleteWorkSchedule(api, id).catch(() => {})
      }
    })

    test('GET /work-schedules returns paginated list', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await listWorkSchedules(api)
      assertOk(res, 'work-schedules list')
      expect(res.pagination).toBeDefined()
    })

    test('GET /work-schedules with scheduleType filter returns 200', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await listWorkSchedules(api, { scheduleType: 'STANDARD' })
      assertOk(res, 'work-schedules filter')
    })

    test('POST /work-schedules creates schedule', async ({ request }) => {
      const api = new ApiClient(request)
      const name = `e2e-schedule-${Date.now()}`
      const res = await createWorkSchedule(api, {
        name,
        scheduleType: 'STANDARD',
        weeklyHours: 40,
        dailyConfig: buildStandardDailyConfig(),
      })
      assertOk(res, 'create work-schedule')
      const data = res.data as Record<string, unknown>
      expect(data.name).toBe(name)
      createdScheduleIds.push(data.id as string)
    })

    test('POST /work-schedules missing name returns 400', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await api.post('/api/v1/work-schedules', {
        scheduleType: 'STANDARD',
        weeklyHours: 40,
        dailyConfig: buildStandardDailyConfig(),
      })
      assertError(res, 400, 'schedule missing name')
    })

    test('POST /work-schedules invalid dailyConfig length returns 400', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await createWorkSchedule(api, {
        name: `e2e-bad-config-${Date.now()}`,
        scheduleType: 'STANDARD',
        weeklyHours: 40,
        dailyConfig: [
          { dayOfWeek: 0, startTime: '09:00', endTime: '18:00', isWorkday: true },
        ], // Only 1 day, needs 7
      })
      assertError(res, 400, 'schedule invalid dailyConfig')
    })

    test('GET /work-schedules/[id] returns detail', async ({ request }) => {
      const api = new ApiClient(request)
      expect(createdScheduleIds.length).toBeGreaterThan(0)
      const res = await getWorkSchedule(api, createdScheduleIds[0])
      assertOk(res, 'work-schedule detail')
      const data = res.data as Record<string, unknown>
      expect(data.id).toBe(createdScheduleIds[0])
    })

    test('PUT /work-schedules/[id] updates name', async ({ request }) => {
      const api = new ApiClient(request)
      const updatedName = `e2e-schedule-updated-${Date.now()}`
      const res = await updateWorkSchedule(api, createdScheduleIds[0], {
        name: updatedName,
      })
      assertOk(res, 'update work-schedule')
      const data = res.data as Record<string, unknown>
      expect(data.name).toBe(updatedName)
    })

    test('DELETE /work-schedules/[id] deletes schedule', async ({ request }) => {
      const api = new ApiClient(request)
      // Create a temporary schedule for deletion
      const tempRes = await createWorkSchedule(api, {
        name: `e2e-schedule-delete-${Date.now()}`,
        scheduleType: 'STANDARD',
        weeklyHours: 40,
        dailyConfig: buildStandardDailyConfig(),
      })
      assertOk(tempRes, 'create temp for delete')
      const tempId = (tempRes.data as Record<string, unknown>).id as string

      const delRes = await deleteWorkSchedule(api, tempId)
      assertOk(delRes, 'delete work-schedule')

      // Verify deleted
      const getRes = await getWorkSchedule(api, tempId)
      assertError(getRes, 404, 'schedule not found after delete')
    })
  })

  // ─── SUPER_ADMIN: Cross-company access ───────────────────

  test.describe('SUPER_ADMIN: Cross-company access', () => {
    test.use({ storageState: authFile('SUPER_ADMIN') })

    let ctrCompanyId: string
    const cleanupHolidayIds: string[] = []

    test.beforeAll(async ({ request }) => {
      const seed = await resolveSeedData(request)
      ctrCompanyId = seed.companyId
    })

    test.afterAll(async ({ request }) => {
      const api = new ApiClient(request)
      for (const id of cleanupHolidayIds) {
        await deleteHoliday(api, id).catch(() => {})
      }
    })

    test('POST /holidays creates with SA own companyId (Zod strips extra fields)', async ({ request }) => {
      // NOTE: holidayCreateSchema doesn't include companyId,
      // so Zod strips it → holiday always uses user.companyId.
      // This test documents that cross-company holiday creation is NOT supported.
      const api = new ApiClient(request)
      const res = await createHoliday(api, {
        name: `e2e-sa-holiday-${Date.now()}`,
        date: futureHolidayDate(30),
        year: 2028,
      })
      assertOk(res, 'SA create holiday')
      const data = res.data as Record<string, unknown>
      expect(data.companyId).toBeTruthy()
      cleanupHolidayIds.push(data.id as string)
    })

    test('GET /holidays returns SA company holidays', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await listHolidays(api)
      assertOk(res, 'SA holidays list')
    })

    test('GET /work-schedules with companyId filter returns 200', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await listWorkSchedules(api, { companyId: ctrCompanyId })
      assertOk(res, 'SA work-schedules cross-company')
    })

    test('GET /work-schedules/[id] with cross-company bypass', async ({ request }) => {
      const api = new ApiClient(request)
      // First get any CTR schedule
      const listRes = await listWorkSchedules(api, { companyId: ctrCompanyId })
      assertOk(listRes, 'list for cross-company detail')
      const items = listRes.data as Array<Record<string, unknown>>
      if (items.length === 0) {
        test.skip(true, 'No CTR work schedules for cross-company test')
        return
      }
      const res = await getWorkSchedule(api, items[0].id as string)
      assertOk(res, 'SA work-schedule cross-company detail')
    })
  })

  // ─── RBAC: EMPLOYEE blocked from write operations ────────

  test.describe('RBAC: EMPLOYEE blocked from holiday/schedule writes', () => {
    test.use({ storageState: authFile('EMPLOYEE') })

    test('EMPLOYEE blocked from POST /holidays', async ({ request }) => {
      const res = await parseApiResponse(
        await request.post('/api/v1/holidays', {
          data: { name: 'test', date: '2028-12-25', year: 2028 },
        }),
      )
      assertError(res, 403, 'employee holiday create')
    })

    test('EMPLOYEE blocked from DELETE /holidays/[id]', async ({ request }) => {
      const fakeId = '00000000-0000-0000-0000-000000000001'
      const res = await parseApiResponse(
        await request.delete(`/api/v1/holidays/${fakeId}`),
      )
      assertError(res, 403, 'employee holiday delete')
    })

    test('EMPLOYEE blocked from POST /work-schedules', async ({ request }) => {
      const res = await parseApiResponse(
        await request.post('/api/v1/work-schedules', {
          data: {
            name: 'test',
            scheduleType: 'STANDARD',
            weeklyHours: 40,
            dailyConfig: buildStandardDailyConfig(),
          },
        }),
      )
      assertError(res, 403, 'employee schedule create')
    })

    test('EMPLOYEE blocked from DELETE /work-schedules/[id]', async ({ request }) => {
      const fakeId = '00000000-0000-0000-0000-000000000001'
      const res = await parseApiResponse(
        await request.delete(`/api/v1/work-schedules/${fakeId}`),
      )
      assertError(res, 403, 'employee schedule delete')
    })

    test('EMPLOYEE can GET /holidays (attendance_read)', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await listHolidays(api)
      assertOk(res, 'employee holiday read')
    })

    test('EMPLOYEE can GET /work-schedules (attendance_read)', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await listWorkSchedules(api)
      assertOk(res, 'employee schedule read')
    })
  })

  // ─── RBAC: MANAGER allowed (has attendance_manage) ───────

  test.describe('RBAC: MANAGER allowed for holiday/schedule writes', () => {
    test.use({ storageState: authFile('MANAGER') })

    const cleanupHolidayIds: string[] = []
    const cleanupScheduleIds: string[] = []

    test.afterAll(async ({ request }) => {
      const api = new ApiClient(request)
      for (const id of cleanupHolidayIds) {
        await deleteHoliday(api, id).catch(() => {})
      }
      for (const id of cleanupScheduleIds) {
        await deleteWorkSchedule(api, id).catch(() => {})
      }
    })

    test('MANAGER can POST /holidays (has attendance_manage)', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await createHoliday(api, {
        name: `e2e-mgr-holiday-${Date.now()}`,
        date: futureHolidayDate(40),
        year: 2028,
      })
      assertOk(res, 'manager holiday create')
      cleanupHolidayIds.push((res.data as Record<string, unknown>).id as string)
    })

    test('MANAGER can POST /work-schedules (has attendance_manage)', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await createWorkSchedule(api, {
        name: `e2e-mgr-schedule-${Date.now()}`,
        scheduleType: 'STANDARD',
        weeklyHours: 40,
        dailyConfig: buildStandardDailyConfig(),
      })
      assertOk(res, 'manager schedule create')
      cleanupScheduleIds.push(
        (res.data as Record<string, unknown>).id as string,
      )
    })
  })
})
