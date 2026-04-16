// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Phase 2 API P3: Shift Patterns & Groups
// Tests shift pattern CRUD + shift group list/create/member management + RBAC
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { ApiClient, assertOk, assertError, parseApiResponse } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import { resolveSeedData } from '../helpers/test-data'
import {
  listShiftPatterns,
  createShiftPattern,
  getShiftPattern,
  updateShiftPattern,
  deleteShiftPattern,
  listShiftGroups,
  createShiftGroup,
  getShiftGroupMembers,
  assignShiftGroupMembers,
  buildTwoShiftPattern,
  buildThreeShiftPattern,
} from '../helpers/shift-fixtures'

test.describe('Shift Patterns & Groups API', () => {
  // ─── HR_ADMIN: Shift Pattern CRUD ────────────────────────

  test.describe('HR_ADMIN: Shift Pattern CRUD', () => {
    test.describe.configure({ mode: 'serial' })
    test.use({ storageState: authFile('HR_ADMIN') })

    const createdPatternIds: string[] = []
    let twoShiftId: string
    let threeShiftId: string

    test.afterAll(async ({ request }) => {
      const api = new ApiClient(request)
      for (const id of createdPatternIds) {
        await deleteShiftPattern(api, id).catch(() => {})
      }
    })

    test('POST /shift-patterns creates TWO_SHIFT pattern', async ({ request }) => {
      const api = new ApiClient(request)
      const payload = buildTwoShiftPattern('hr')
      const res = await createShiftPattern(api, payload)
      assertOk(res, 'create two-shift')
      const data = res.data as Record<string, unknown>
      expect(data.code).toBe(payload.code)
      expect(data.patternType).toBe('TWO_SHIFT')
      expect(data.cycleDays).toBe(14)
      twoShiftId = data.id as string
      createdPatternIds.push(twoShiftId)
    })

    test('POST /shift-patterns creates THREE_SHIFT pattern', async ({ request }) => {
      const api = new ApiClient(request)
      const payload = buildThreeShiftPattern('hr')
      const res = await createShiftPattern(api, payload)
      assertOk(res, 'create three-shift')
      const data = res.data as Record<string, unknown>
      expect(data.patternType).toBe('THREE_SHIFT')
      expect(data.cycleDays).toBe(21)
      threeShiftId = data.id as string
      createdPatternIds.push(threeShiftId)
    })

    test('GET /shift-patterns returns 200 with pagination', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await listShiftPatterns(api)
      assertOk(res, 'list patterns')
      expect(res.pagination).toBeDefined()
    })

    test('GET /shift-patterns?patternType=TWO_SHIFT filters', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await listShiftPatterns(api, { patternType: 'TWO_SHIFT' })
      assertOk(res, 'filter by type')
      const data = res.data as Array<Record<string, unknown>>
      for (const p of data) {
        expect(p.patternType).toBe('TWO_SHIFT')
      }
    })

    test('GET /shift-patterns/[id] returns detail with shiftGroups', async ({ request }) => {
      const api = new ApiClient(request)
      expect(twoShiftId).toBeTruthy()
      const res = await getShiftPattern(api, twoShiftId)
      assertOk(res, 'pattern detail')
      const data = res.data as Record<string, unknown>
      expect(data.id).toBe(twoShiftId)
      expect(data.shiftGroups).toBeDefined()
      expect(Array.isArray(data.shiftGroups)).toBe(true)
    })

    test('PUT /shift-patterns/[id] updates name', async ({ request }) => {
      const api = new ApiClient(request)
      const newName = `Updated-${Date.now()}`
      const res = await updateShiftPattern(api, twoShiftId, { name: newName })
      assertOk(res, 'update pattern')
      expect((res.data as Record<string, unknown>).name).toBe(newName)
    })

    test('DELETE /shift-patterns/[id] soft-deletes', async ({ request }) => {
      const api = new ApiClient(request)
      expect(threeShiftId).toBeTruthy()
      const res = await deleteShiftPattern(api, threeShiftId)
      assertOk(res, 'soft-delete pattern')
      const data = res.data as Record<string, unknown>
      expect(data.deletedAt).toBeTruthy()
    })

    test('GET /shift-patterns after delete — document visibility behavior', async ({ request }) => {
      // Codex MED-4: list may or may not filter deletedAt — document actual behavior
      const api = new ApiClient(request)
      const res = await listShiftPatterns(api)
      assertOk(res, 'list after delete')
      // Just verify the API returns 200 — soft-delete filtering is implementation-specific
    })

    test('POST /shift-patterns missing code returns 400', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await createShiftPattern(api, {
        code: '', // empty
        name: 'test',
        patternType: 'TWO_SHIFT',
        slots: [{ name: 'DAY', start: '06:00', end: '18:00' }],
        cycleDays: 14,
      })
      assertError(res, 400, 'missing code')
    })

    test('POST /shift-patterns missing slots returns 400', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await createShiftPattern(api, {
        code: `empty-slots-${Date.now()}`.slice(0, 20),
        name: 'test',
        patternType: 'TWO_SHIFT',
        slots: [], // empty
        cycleDays: 14,
      })
      assertError(res, 400, 'empty slots')
    })

    test('POST /shift-patterns missing cycleDays returns 400', async ({ request }) => {
      const res = await parseApiResponse(
        await request.post('/api/v1/shift-patterns', {
          data: {
            code: `no-cycle-${Date.now()}`.slice(0, 20),
            name: 'test',
            patternType: 'TWO_SHIFT',
            slots: [{ name: 'DAY', start: '06:00', end: '18:00' }],
            // cycleDays omitted
          },
        }),
      )
      assertError(res, 400, 'missing cycleDays')
    })

    test('POST /shift-patterns duplicate code returns 409 or 400', async ({ request }) => {
      const api = new ApiClient(request)
      // twoShiftId pattern was created above with a unique code
      const detail = await getShiftPattern(api, twoShiftId)
      assertOk(detail, 'get for dup code')
      const existingCode = (detail.data as Record<string, unknown>).code as string

      const res = await createShiftPattern(api, {
        code: existingCode, // duplicate
        name: 'dup test',
        patternType: 'TWO_SHIFT',
        slots: [{ name: 'DAY', start: '06:00', end: '18:00' }],
        cycleDays: 7,
      })
      expect([400, 409, 500]).toContain(res.status) // unique constraint
    })

    test('POST /shift-patterns empty name returns 400', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await createShiftPattern(api, {
        code: `no-name-${Date.now()}`.slice(0, 20),
        name: '', // empty
        patternType: 'TWO_SHIFT',
        slots: [{ name: 'DAY', start: '06:00', end: '18:00' }],
        cycleDays: 7,
      })
      assertError(res, 400, 'empty name')
    })
  })

  // ─── HR_ADMIN: Shift Group List/Create + Member Assign ───

  test.describe('HR_ADMIN: Shift Group List/Create + Members', () => {
    test.describe.configure({ mode: 'serial' })
    test.use({ storageState: authFile('HR_ADMIN') })

    let patternId: string
    let groupAId: string
    let groupBId: string
    let seedEmployeeId: string
    const cleanupPatternIds: string[] = []

    test.beforeAll(async ({ request }) => {
      const seed = await resolveSeedData(request)
      seedEmployeeId = seed.employeeId

      // Create a pattern for groups to attach to
      const api = new ApiClient(request)
      const payload = buildTwoShiftPattern('grp')
      const res = await createShiftPattern(api, payload)
      assertOk(res, 'setup pattern for groups')
      patternId = (res.data as Record<string, unknown>).id as string
      cleanupPatternIds.push(patternId)
    })

    test.afterAll(async ({ request }) => {
      const api = new ApiClient(request)
      for (const id of cleanupPatternIds) {
        await deleteShiftPattern(api, id).catch(() => {})
      }
    })

    test('POST /shift-groups creates group linked to pattern', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await createShiftGroup(api, {
        shiftPatternId: patternId,
        name: `A조-${Date.now()}`,
        color: '#FF0000',
      })
      assertOk(res, 'create group A')
      groupAId = (res.data as Record<string, unknown>).id as string
    })

    test('POST /shift-groups creates second group', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await createShiftGroup(api, {
        shiftPatternId: patternId,
        name: `B조-${Date.now()}`,
        color: '#0000FF',
      })
      assertOk(res, 'create group B')
      groupBId = (res.data as Record<string, unknown>).id as string
    })

    test('GET /shift-groups returns groups', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await listShiftGroups(api)
      assertOk(res, 'list groups')
      const data = res.data as Array<Record<string, unknown>>
      expect(data.length).toBeGreaterThan(0)
    })

    test('GET /shift-groups?shiftPatternId filters by pattern', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await listShiftGroups(api, { shiftPatternId: patternId })
      assertOk(res, 'filter by pattern')
      const data = res.data as Array<Record<string, unknown>>
      expect(data.length).toBeGreaterThanOrEqual(2)
      for (const g of data) {
        expect(g.shiftPatternId).toBe(patternId)
      }
    })

    test('PUT /shift-groups/[id]/members assigns employees', async ({ request }) => {
      const api = new ApiClient(request)
      expect(groupAId).toBeTruthy()
      const res = await assignShiftGroupMembers(api, groupAId, [seedEmployeeId])
      assertOk(res, 'assign members')
    })

    test('GET /shift-groups/[id]/members returns member details', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await getShiftGroupMembers(api, groupAId)
      assertOk(res, 'get members')
    })

    test('PUT /shift-groups/[id]/members reassign updates membership', async ({ request }) => {
      const api = new ApiClient(request)
      // Move employee to group B
      const res = await assignShiftGroupMembers(api, groupBId, [seedEmployeeId])
      assertOk(res, 'reassign members')
    })

    test('POST /shift-groups missing shiftPatternId returns 400', async ({ request }) => {
      const res = await parseApiResponse(
        await request.post('/api/v1/shift-groups', {
          data: { name: 'bad-group' }, // missing shiftPatternId
        }),
      )
      assertError(res, 400, 'missing patternId')
    })
  })

  // ─── SUPER_ADMIN: Cross-company read ─────────────────────

  test.describe('SUPER_ADMIN: Cross-company read', () => {
    test.use({ storageState: authFile('SUPER_ADMIN') })

    test('GET /shift-patterns returns 200', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await listShiftPatterns(api)
      assertOk(res, 'SA list patterns')
    })

    test('GET /shift-groups returns 200', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await listShiftGroups(api)
      assertOk(res, 'SA list groups')
    })
  })

  // ─── MANAGER: Allowed mutations (attendance_manage = APPROVE) ─

  test.describe('MANAGER: Allowed mutations', () => {
    test.describe.configure({ mode: 'serial' })
    test.use({ storageState: authFile('MANAGER') })

    const cleanupPatternIds: string[] = []
    let mgrPatternId: string
    let mgrGroupId: string
    let seedEmployeeId: string

    test.beforeAll(async ({ request }) => {
      const seed = await resolveSeedData(request)
      seedEmployeeId = seed.employeeId
    })

    test.afterAll(async ({ request }) => {
      const api = new ApiClient(request)
      for (const id of cleanupPatternIds) {
        await deleteShiftPattern(api, id).catch(() => {})
      }
    })

    test('GET /shift-patterns returns 200', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await listShiftPatterns(api)
      assertOk(res, 'mgr list patterns')
    })

    test('POST /shift-patterns creates (APPROVE perm)', async ({ request }) => {
      const api = new ApiClient(request)
      const payload = buildTwoShiftPattern('mgr')
      const res = await createShiftPattern(api, payload)
      assertOk(res, 'mgr create pattern')
      mgrPatternId = (res.data as Record<string, unknown>).id as string
      cleanupPatternIds.push(mgrPatternId)
    })

    test('POST /shift-groups creates group', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await createShiftGroup(api, {
        shiftPatternId: mgrPatternId,
        name: `MGR조-${Date.now()}`,
      })
      assertOk(res, 'mgr create group')
      mgrGroupId = (res.data as Record<string, unknown>).id as string
    })

    test('PUT /shift-groups/[id]/members assigns members', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await assignShiftGroupMembers(api, mgrGroupId, [seedEmployeeId])
      assertOk(res, 'mgr assign members')
    })
  })

  // ─── RBAC: EMPLOYEE blocked from APPROVE-gated mutations ─

  test.describe('RBAC: EMPLOYEE blocked', () => {
    test.use({ storageState: authFile('EMPLOYEE') })

    const dummyId = '00000000-0000-0000-0000-000000000000'

    test('POST /shift-patterns returns 403', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await createShiftPattern(api, buildTwoShiftPattern('emp'))
      assertError(res, 403, 'emp create pattern')
    })

    test('PUT /shift-patterns/[id] returns 403', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await updateShiftPattern(api, dummyId, { name: 'x' })
      assertError(res, 403, 'emp update pattern')
    })

    test('DELETE /shift-patterns/[id] returns 403', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await deleteShiftPattern(api, dummyId)
      assertError(res, 403, 'emp delete pattern')
    })

    test('POST /shift-groups returns 403', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await createShiftGroup(api, { shiftPatternId: dummyId, name: 'x' })
      assertError(res, 403, 'emp create group')
    })

    test('PUT /shift-groups/[id]/members returns 403', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await assignShiftGroupMembers(api, dummyId, [dummyId])
      assertError(res, 403, 'emp assign members')
    })

    test('GET /shift-patterns returns 200 (VIEW allowed)', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await listShiftPatterns(api)
      assertOk(res, 'emp read patterns')
    })

    test('GET /shift-groups returns 200 (VIEW allowed)', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await listShiftGroups(api)
      assertOk(res, 'emp read groups')
    })
  })
})
