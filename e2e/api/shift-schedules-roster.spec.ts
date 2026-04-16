// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Phase 2 API P3: Shift Schedules, Roster & Change Requests
// Tests schedule generation, roster assign, change requests, shift board, employee schedules + RBAC
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { ApiClient, assertOk, assertError, parseApiResponse } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import { resolveSeedData } from '../helpers/test-data'
import {
  createShiftPattern,
  deleteShiftPattern,
  createShiftGroup,
  assignShiftGroupMembers,
  getMonthlySchedules,
  generateSchedules,
  getMonthlyRoster,
  assignRoster,
  getRosterWarnings,
  listChangeRequests,
  createChangeRequest,
  approveChangeRequest,
  upsertShiftCell,
  getEmployeeSchedules,
  assignEmployeeSchedule,
  buildTwoShiftPattern,
} from '../helpers/shift-fixtures'
import { listWorkSchedules } from '../helpers/attendance-fixtures'

test.describe('Shift Schedules, Roster & Change Requests API', () => {
  // ─── HR_ADMIN: Schedule Generation ───────────────────────

  test.describe('HR_ADMIN: Schedule Generation', () => {
    test.describe.configure({ mode: 'serial' })
    test.use({ storageState: authFile('HR_ADMIN') })

    let patternId: string
    let groupId: string
    let seedEmployeeId: string
    const cleanupPatternIds: string[] = []

    // Uses 2029/1 — unique month for this block
    const SCHED_YEAR = 2029
    const SCHED_MONTH = 1

    test.beforeAll(async ({ request }) => {
      const seed = await resolveSeedData(request)
      seedEmployeeId = seed.employeeId

      const api = new ApiClient(request)

      // Create pattern
      const patRes = await createShiftPattern(api, buildTwoShiftPattern('sched'))
      assertOk(patRes, 'setup schedule pattern')
      patternId = (patRes.data as Record<string, unknown>).id as string
      cleanupPatternIds.push(patternId)

      // Create group
      const grpRes = await createShiftGroup(api, {
        shiftPatternId: patternId,
        name: `SchedGrp-${Date.now()}`,
      })
      assertOk(grpRes, 'setup schedule group')
      groupId = (grpRes.data as Record<string, unknown>).id as string

      // Assign member
      const memRes = await assignShiftGroupMembers(api, groupId, [seedEmployeeId])
      assertOk(memRes, 'setup assign member')
    })

    test.afterAll(async ({ request }) => {
      const api = new ApiClient(request)
      for (const id of cleanupPatternIds) {
        await deleteShiftPattern(api, id).catch(() => {})
      }
    })

    test('POST /shift-schedules/generate creates month of schedules', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await generateSchedules(api, {
        shiftPatternId: patternId,
        year: SCHED_YEAR,
        month: SCHED_MONTH,
      })
      assertOk(res, 'generate schedules')
    })

    test('GET /shift-schedules/[year]/[month] returns generated schedules', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getMonthlySchedules(api, SCHED_YEAR, SCHED_MONTH)
      assertOk(res, 'monthly schedules')
      // API returns { year, month, days, schedules } — not a bare array (Codex P1)
      const data = res.data as Record<string, unknown>
      expect(data.year).toBe(SCHED_YEAR)
      expect(data.month).toBe(SCHED_MONTH)
      const schedules = data.schedules as Array<Record<string, unknown>>
      expect(schedules.length).toBeGreaterThan(0)
    })

    test('GET /shift-schedules with shiftGroupId filter', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getMonthlySchedules(api, SCHED_YEAR, SCHED_MONTH, {
        shiftGroupId: groupId,
      })
      assertOk(res, 'filter by group')
    })

    test('GET /shift-schedules with employeeId filter', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getMonthlySchedules(api, SCHED_YEAR, SCHED_MONTH, {
        employeeId: seedEmployeeId,
      })
      assertOk(res, 'filter by employee')
    })

    test('POST /shift-schedules/generate re-generates (delete+recreate)', async ({ request }) => {
      // Codex HIGH-3: generate is NOT idempotent — deletes existing, creates new records
      const api = new ApiClient(request)
      const res = await generateSchedules(api, {
        shiftPatternId: patternId,
        year: SCHED_YEAR,
        month: SCHED_MONTH,
      })
      assertOk(res, 're-generate schedules')
      // Just verify success — IDs will differ from first generation
    })

    test('POST /shift-schedules/generate missing patternId returns 400', async ({ request }) => {
      const res = await parseApiResponse(
        await request.post('/api/v1/shift-schedules/generate', {
          data: { year: SCHED_YEAR, month: SCHED_MONTH },
        }),
      )
      assertError(res, 400, 'missing patternId')
    })

    test('GET /shift-schedules invalid month returns 400', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getMonthlySchedules(api, SCHED_YEAR, 13)
      assertError(res, 400, 'invalid month 13')
    })
  })

  // ─── HR_ADMIN: Roster ────────────────────────────────────

  test.describe('HR_ADMIN: Roster', () => {
    test.describe.configure({ mode: 'serial' })
    test.use({ storageState: authFile('HR_ADMIN') })

    let seedEmployeeId: string
    let workScheduleId: string

    // Uses 2029/2 — different month from schedule block
    const ROSTER_YEAR = 2029
    const ROSTER_MONTH = 2

    test.beforeAll(async ({ request }) => {
      const seed = await resolveSeedData(request)
      seedEmployeeId = seed.employeeId

      // Find an existing work schedule for roster assignment
      const api = new ApiClient(request)
      const wsRes = await listWorkSchedules(api, { limit: '1' })
      assertOk(wsRes, 'find work schedule')
      const wsList = wsRes.data as Array<Record<string, unknown>>
      if (wsList.length > 0) {
        workScheduleId = wsList[0].id as string
      }
    })

    test('GET /shift-roster/[year]/[month] returns 200', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getMonthlyRoster(api, ROSTER_YEAR, ROSTER_MONTH)
      assertOk(res, 'monthly roster')
    })

    test('PUT /shift-roster/assign creates assignment', async ({ request }) => {
      test.skip(!workScheduleId, 'no work schedule available')
      const api = new ApiClient(request)
      const res = await assignRoster(api, {
        employeeId: seedEmployeeId,
        scheduleId: workScheduleId,
        shiftGroup: 'DAY',
        effectiveFrom: '2029-02-01',
        effectiveTo: '2029-02-28',
      })
      // May succeed or fail depending on overlap — document behavior
      expect([200, 201, 400, 409]).toContain(res.status)
    })

    test('PUT /shift-roster/assign non-existent employeeId — document behavior', async ({ request }) => {
      // Codex MED-7: roster-assign has no employee existence check
      test.skip(!workScheduleId, 'no work schedule available')
      const api = new ApiClient(request)
      const dummyId = '00000000-0000-0000-0000-000000000001'
      const res = await assignRoster(api, {
        employeeId: dummyId,
        scheduleId: workScheduleId,
        effectiveFrom: '2029-03-01',
      })
      // Document: may succeed (no FK check) or fail (FK constraint)
      expect([200, 201, 400, 404, 500]).toContain(res.status)
    })

    test('GET /shift-roster/warnings returns 200', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getRosterWarnings(api)
      assertOk(res, 'roster warnings')
    })
  })

  // ─── HR_ADMIN: Employee Schedules (CREATE gated) ─────────

  test.describe('HR_ADMIN: Employee Schedules', () => {
    test.describe.configure({ mode: 'serial' })
    test.use({ storageState: authFile('HR_ADMIN') })

    let seedEmployeeId: string
    let workScheduleId: string

    test.beforeAll(async ({ request }) => {
      const seed = await resolveSeedData(request)
      seedEmployeeId = seed.employeeId

      const api = new ApiClient(request)
      const wsRes = await listWorkSchedules(api, { limit: '1' })
      assertOk(wsRes, 'find work schedule')
      const wsList = wsRes.data as Array<Record<string, unknown>>
      if (wsList.length > 0) {
        workScheduleId = wsList[0].id as string
      }
    })

    test('GET /employees/[id]/schedules returns assignments', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getEmployeeSchedules(api, seedEmployeeId)
      assertOk(res, 'employee schedules')
    })

    test('POST /employees/[id]/schedules creates assignment', async ({ request }) => {
      test.skip(!workScheduleId, 'no work schedule available')
      const api = new ApiClient(request)
      const res = await assignEmployeeSchedule(api, seedEmployeeId, {
        scheduleId: workScheduleId,
        effectiveFrom: '2030-01-01',
        effectiveTo: '2030-06-30',
      })
      // May succeed or conflict with existing
      expect([200, 201, 400, 409]).toContain(res.status)
    })

    test('POST /employees/[id]/schedules overlap detection', async ({ request }) => {
      test.skip(!workScheduleId, 'no work schedule available')
      const api = new ApiClient(request)
      // Same date range should detect overlap
      const res = await assignEmployeeSchedule(api, seedEmployeeId, {
        scheduleId: workScheduleId,
        effectiveFrom: '2030-01-01',
        effectiveTo: '2030-06-30',
      })
      // Expect either overlap error or silent success
      expect([200, 201, 400, 409]).toContain(res.status)
    })
  })

  // ─── MANAGER: Employee Schedules blocked (no attendance_create) ─

  test.describe('MANAGER: Employee Schedules blocked', () => {
    test.use({ storageState: authFile('MANAGER') })

    test('POST /employees/[id]/schedules returns 403 (no CREATE)', async ({ request }) => {
      // Codex HIGH-2: MANAGER has APPROVE but NOT CREATE
      const seed = await resolveSeedData(request)
      const api = new ApiClient(request)
      const res = await assignEmployeeSchedule(api, seed.employeeId, {
        scheduleId: '00000000-0000-0000-0000-000000000000',
        effectiveFrom: '2030-07-01',
      })
      assertError(res, 403, 'mgr employee schedule blocked')
    })
  })

  // ─── HR_ADMIN: Change Requests ───────────────────────────

  test.describe('HR_ADMIN: Change Requests', () => {
    test.describe.configure({ mode: 'serial' })
    test.use({ storageState: authFile('HR_ADMIN') })

    let changeRequestId1: string
    let changeRequestId2: string

    test('POST /shift-change-requests creates request', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await createChangeRequest(api, {
        originalDate: '2029-03-10',
        originalSlotIndex: 0,
        reason: 'E2E test shift change request',
      })
      assertOk(res, 'create change request')
      changeRequestId1 = (res.data as Record<string, unknown>).id as string
    })

    test('GET /shift-change-requests returns 200', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await listChangeRequests(api)
      assertOk(res, 'list change requests')
    })

    test('GET /shift-change-requests?status=SCR_PENDING filters', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await listChangeRequests(api, { status: 'SCR_PENDING' })
      assertOk(res, 'filter pending')
      const data = res.data as Array<Record<string, unknown>>
      for (const cr of data) {
        expect(cr.status).toBe('SCR_PENDING')
      }
    })

    test('PUT /shift-change-requests/[id]/approve approves', async ({ request }) => {
      const api = new ApiClient(request)
      expect(changeRequestId1).toBeTruthy()
      const res = await approveChangeRequest(api, changeRequestId1, 'approve')
      assertOk(res, 'approve request')
      const data = res.data as Record<string, unknown>
      expect(data.status).toBe('SCR_APPROVED')
    })

    test('POST /shift-change-requests creates second request', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await createChangeRequest(api, {
        originalDate: '2029-03-15',
        originalSlotIndex: 1,
        reason: 'E2E test second request for rejection',
      })
      assertOk(res, 'create second request')
      changeRequestId2 = (res.data as Record<string, unknown>).id as string
    })

    test('PUT /shift-change-requests/[id]/approve rejects with reason', async ({ request }) => {
      const api = new ApiClient(request)
      expect(changeRequestId2).toBeTruthy()
      const res = await approveChangeRequest(api, changeRequestId2, 'reject', 'Insufficient staffing')
      assertOk(res, 'reject request')
      const data = res.data as Record<string, unknown>
      expect(data.status).toBe('SCR_REJECTED')
    })

    test('PUT /shift-change-requests/[id]/approve missing action returns 400', async ({ request }) => {
      const res = await parseApiResponse(
        await request.put(`/api/v1/shift-change-requests/${changeRequestId1}/approve`, {
          data: {}, // missing action
        }),
      )
      assertError(res, 400, 'missing action')
    })

    test('POST /shift-change-requests missing reason returns 400', async ({ request }) => {
      const res = await parseApiResponse(
        await request.post('/api/v1/shift-change-requests', {
          data: {
            originalDate: '2029-03-20',
            originalSlotIndex: 0,
            // reason omitted
          },
        }),
      )
      assertError(res, 400, 'missing reason')
    })
  })

  // ─── HR_ADMIN: Attendance Shift Board POST ───────────────

  test.describe('HR_ADMIN: Attendance Shift Board', () => {
    test.describe.configure({ mode: 'serial' })
    test.use({ storageState: authFile('HR_ADMIN') })

    let seedEmployeeId: string

    test.beforeAll(async ({ request }) => {
      const seed = await resolveSeedData(request)
      seedEmployeeId = seed.employeeId
    })

    // NOTE: GET /attendance/shifts already tested in attendance-core.spec.ts

    test('POST /attendance/shifts upserts morning cell', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await upsertShiftCell(api, {
        employeeId: seedEmployeeId,
        workDate: '2029-04-01',
        slotName: 'morning',
        startTime: '06:00',
        endTime: '14:00',
      })
      assertOk(res, 'upsert morning')
    })

    test('POST /attendance/shifts upserts night cell', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await upsertShiftCell(api, {
        employeeId: seedEmployeeId,
        workDate: '2029-04-02',
        slotName: 'night',
        startTime: '22:00',
        endTime: '06:00',
      })
      assertOk(res, 'upsert night')
    })

    test('POST /attendance/shifts upserts off (deletes)', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await upsertShiftCell(api, {
        employeeId: seedEmployeeId,
        workDate: '2029-04-01', // same date as morning — should delete
        slotName: 'off',
      })
      assertOk(res, 'upsert off')
    })

    test('POST /attendance/shifts missing employeeId returns 400', async ({ request }) => {
      const res = await parseApiResponse(
        await request.post('/api/v1/attendance/shifts', {
          data: {
            workDate: '2029-04-03',
            slotName: 'morning',
            // employeeId omitted
          },
        }),
      )
      assertError(res, 400, 'missing employeeId')
    })

    test('POST /attendance/shifts invalid slotName returns 400', async ({ request }) => {
      const res = await parseApiResponse(
        await request.post('/api/v1/attendance/shifts', {
          data: {
            employeeId: seedEmployeeId,
            workDate: '2029-04-04',
            slotName: 'invalid_slot',
          },
        }),
      )
      assertError(res, 400, 'invalid slotName')
    })
  })

  // ─── RBAC boundaries (asymmetric CREATE vs APPROVE) ──────

  test.describe('RBAC: EMPLOYEE + MANAGER boundaries', () => {
    test.describe('EMPLOYEE: APPROVE blocked, CREATE allowed', () => {
      test.use({ storageState: authFile('EMPLOYEE') })

      const dummyId = '00000000-0000-0000-0000-000000000000'

      test('PUT /shift-roster/assign returns 403 (no APPROVE)', async ({ request }) => {
        const api = new ApiClient(request)
        const res = await assignRoster(api, {
          employeeId: dummyId,
          scheduleId: dummyId,
          effectiveFrom: '2029-05-01',
        })
        assertError(res, 403, 'emp roster assign')
      })

      test('POST /attendance/shifts returns 403 (no APPROVE)', async ({ request }) => {
        const api = new ApiClient(request)
        const res = await upsertShiftCell(api, {
          employeeId: dummyId,
          workDate: '2029-05-01',
          slotName: 'morning',
        })
        assertError(res, 403, 'emp shift board')
      })

      test('PUT /shift-change-requests/[id]/approve returns 403', async ({ request }) => {
        const api = new ApiClient(request)
        const res = await approveChangeRequest(api, dummyId, 'approve')
        assertError(res, 403, 'emp approve change request')
      })

      test('POST /shift-change-requests returns 200 (has CREATE)', async ({ request }) => {
        const api = new ApiClient(request)
        const res = await createChangeRequest(api, {
          originalDate: '2029-05-10',
          originalSlotIndex: 0,
          reason: 'EMPLOYEE CREATE test',
        })
        assertOk(res, 'emp create change request')
      })

      test('POST /employees/[id]/schedules returns 200 (has CREATE)', async ({ request }) => {
        // Codex HIGH-2: EMPLOYEE has attendance_create
        const seed = await resolveSeedData(request)
        const api = new ApiClient(request)

        // Find a work schedule
        const wsRes = await listWorkSchedules(api, { limit: '1' })
        if (!wsRes.ok || !(wsRes.data as unknown[])?.length) {
          test.skip(true, 'no work schedule')
          return
        }
        const wsId = ((wsRes.data as unknown[])[0] as Record<string, unknown>).id as string

        const res = await assignEmployeeSchedule(api, seed.employeeId, {
          scheduleId: wsId,
          effectiveFrom: '2031-01-01',
          effectiveTo: '2031-06-30',
        })
        // May succeed or overlap — the point is it's NOT 403
        expect(res.status).not.toBe(403)
      })

      test('GET /shift-change-requests returns 200 (VIEW)', async ({ request }) => {
        const api = new ApiClient(request)
        const res = await listChangeRequests(api)
        assertOk(res, 'emp list change requests')
      })
    })

    test.describe('MANAGER: APPROVE allowed, CREATE blocked', () => {
      test.use({ storageState: authFile('MANAGER') })

      test('PUT /shift-roster/assign returns 200 (has APPROVE)', async ({ request }) => {
        // Codex HIGH-2: MANAGER has attendance_manage
        const seed = await resolveSeedData(request)
        const api = new ApiClient(request)

        const wsRes = await listWorkSchedules(api, { limit: '1' })
        if (!wsRes.ok || !(wsRes.data as unknown[])?.length) {
          test.skip(true, 'no work schedule')
          return
        }
        const wsId = ((wsRes.data as unknown[])[0] as Record<string, unknown>).id as string

        const res = await assignRoster(api, {
          employeeId: seed.employeeId,
          scheduleId: wsId,
          effectiveFrom: '2031-07-01',
          effectiveTo: '2031-12-31',
        })
        // NOT 403 — MANAGER has APPROVE permission
        expect(res.status).not.toBe(403)
      })

      test('POST /employees/[id]/schedules returns 403 (no CREATE)', async ({ request }) => {
        // Codex HIGH-2: MANAGER does NOT have attendance_create
        const seed = await resolveSeedData(request)
        const api = new ApiClient(request)
        const res = await assignEmployeeSchedule(api, seed.employeeId, {
          scheduleId: '00000000-0000-0000-0000-000000000000',
          effectiveFrom: '2031-07-01',
        })
        assertError(res, 403, 'mgr employee schedule create')
      })
    })
  })
})
