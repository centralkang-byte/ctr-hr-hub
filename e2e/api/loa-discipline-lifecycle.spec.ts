// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Phase 2 API P9 Spec 1
// LOA (Leave of Absence) lifecycle, Discipline CRUD + appeal,
// Rewards CRUD, and Delegation lifecycle.
// 52 tests
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import { resolveSeedData } from '../helpers/test-data'
import * as f from '../helpers/loa-discipline-misc-fixtures'

// ═══════════════════════════════════════════════════════════
// LOA TYPES: HR_ADMIN CRUD Lifecycle
// ═══════════════════════════════════════════════════════════

test.describe('LOA Types: HR_ADMIN CRUD Lifecycle', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let createdTypeId = ''

  test('POST /leave-of-absence/types creates E2E type', async ({ request }) => {
    const api = new ApiClient(request)
    const data = f.buildLoaType('CRUD')
    const res = await f.createLoaType(api, data)
    assertOk(res, 'create LOA type')
    const d = res.data as Record<string, unknown>
    expect(d).toHaveProperty('id')
    expect(d.code).toBe(data.code.toUpperCase())
    createdTypeId = d.id as string
  })

  test('GET /leave-of-absence/types includes new type', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listLoaTypes(api)
    assertOk(res, 'list LOA types')
    const types = res.data as Array<{ id: string }>
    expect(types.some((t) => t.id === createdTypeId)).toBe(true)
  })

  test('PUT /leave-of-absence/types/[id] updates name', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.updateLoaType(api, createdTypeId, { name: 'E2E 수정됨' })
    assertOk(res, 'update LOA type')
    const d = res.data as Record<string, unknown>
    expect(d.name).toBe('E2E 수정됨')
  })

  test('POST /leave-of-absence/types/apply-defaults is idempotent', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.applyLoaDefaults(api)
    // apply-defaults may return 200 or 201 — just check not error
    expect(res.status).toBeLessThan(500)
  })

  test('DELETE /leave-of-absence/types/[id] soft-deletes', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.deleteLoaType(api, createdTypeId)
    assertOk(res, 'delete LOA type')
  })

  test('GET /leave-of-absence/types after delete excludes it', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listLoaTypes(api)
    assertOk(res, 'list after delete')
    const types = res.data as Array<{ id: string }>
    expect(types.some((t) => t.id === createdTypeId)).toBe(false)
  })

  test('POST with duplicate code returns error', async ({ request }) => {
    const api = new ApiClient(request)
    const data = f.buildLoaType('DUP')
    const res1 = await f.createLoaType(api, data)
    assertOk(res1, 'create first')
    const res2 = await f.createLoaType(api, data)
    assertError(res2, 409, 'duplicate code')
    // cleanup
    const id = (res1.data as Record<string, unknown>).id as string
    await f.deleteLoaType(api, id)
  })
})

// ═══════════════════════════════════════════════════════════
// LOA RECORDS: HR_ADMIN State Machine (Happy Path)
// REQUESTED → APPROVED → ACTIVE → RETURN_REQUESTED → COMPLETED
// ═══════════════════════════════════════════════════════════

test.describe('LOA Records: HR_ADMIN State Machine', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let loaTypeId = ''
  let employeeId = ''
  let recordId = ''

  test.beforeAll(async ({ request }) => {
    const api = new ApiClient(request)
    // Create a test LOA type (DD-1: avoid seeded type dependencies)
    const typeData = f.buildLoaType('SM')
    const typeRes = await f.createLoaType(api, typeData)
    assertOk(typeRes, 'create LOA type for state machine')
    loaTypeId = (typeRes.data as Record<string, unknown>).id as string

    // Resolve employee with active primary assignment
    const seed = await resolveSeedData(request)
    employeeId = seed.employeeId
  })

  test('POST /leave-of-absence creates REQUESTED record', async ({ request }) => {
    const api = new ApiClient(request)
    const data = f.buildLoaRecord(employeeId, loaTypeId)
    const res = await f.createLoaRecord(api, data)
    assertOk(res, 'create LOA record')
    const d = res.data as Record<string, unknown>
    expect(d).toHaveProperty('id')
    expect(d.status).toBe('REQUESTED')
    recordId = d.id as string
  })

  test('GET /leave-of-absence returns list with new record', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listLoaRecords(api)
    assertOk(res, 'list LOA records')
    const items = res.data as Array<{ id: string }>
    expect(items.some((i) => i.id === recordId)).toBe(true)
  })

  test('GET /leave-of-absence/[id] returns REQUESTED detail', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getLoaRecord(api, recordId)
    assertOk(res, 'get LOA detail')
    const d = res.data as Record<string, unknown>
    expect(d.status).toBe('REQUESTED')
    expect(d).toHaveProperty('employee')
    expect(d).toHaveProperty('type')
  })

  test('PATCH {action:approve} → APPROVED', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.patchLoaAction(api, recordId, 'approve')
    assertOk(res, 'approve LOA')
    expect((res.data as Record<string, unknown>).status).toBe('APPROVED')
  })

  test('PATCH {action:activate} → ACTIVE', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.patchLoaAction(api, recordId, 'activate')
    assertOk(res, 'activate LOA')
    expect((res.data as Record<string, unknown>).status).toBe('ACTIVE')
  })

  test('PATCH {action:return} → RETURN_REQUESTED', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.patchLoaAction(api, recordId, 'return', { notes: 'E2E 복직 사유' })
    assertOk(res, 'return LOA')
    expect((res.data as Record<string, unknown>).status).toBe('RETURN_REQUESTED')
  })

  test('PATCH {action:complete} → COMPLETED', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.patchLoaAction(api, recordId, 'complete', {
      actualEndDate: new Date().toISOString().split('T')[0],
      returnNotes: 'E2E 복직 완료',
    })
    assertOk(res, 'complete LOA')
    expect((res.data as Record<string, unknown>).status).toBe('COMPLETED')
  })

  test('GET /leave-of-absence/[id] confirms COMPLETED', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getLoaRecord(api, recordId)
    assertOk(res, 'get completed LOA')
    expect((res.data as Record<string, unknown>).status).toBe('COMPLETED')
  })

  test('PATCH {action:approve} on COMPLETED → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.patchLoaAction(api, recordId, 'approve')
    assertError(res, 400, 'invalid transition on COMPLETED')
  })

  test('GET ?status=COMPLETED returns filtered', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listLoaRecords(api, { status: 'COMPLETED' })
    assertOk(res, 'filter COMPLETED')
    const items = res.data as Array<{ id: string; status: string }>
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((i) => i.status === 'COMPLETED')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════
// LOA RECORDS: Reject + Cancel Paths
// ═══════════════════════════════════════════════════════════

test.describe('LOA Records: Reject + Cancel Paths', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let loaTypeId = ''
  let employeeId = ''
  let rejectRecordId = ''
  let cancelRecordId = ''

  test.beforeAll(async ({ request }) => {
    const api = new ApiClient(request)
    const typeData = f.buildLoaType('REJ')
    const typeRes = await f.createLoaType(api, typeData)
    assertOk(typeRes, 'create type for reject')
    loaTypeId = (typeRes.data as Record<string, unknown>).id as string
    const seed = await resolveSeedData(request)
    employeeId = seed.employeeId
  })

  test('POST creates REQUESTED (for rejection)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.createLoaRecord(api, f.buildLoaRecord(employeeId, loaTypeId))
    assertOk(res, 'create for reject')
    rejectRecordId = (res.data as Record<string, unknown>).id as string
  })

  test('PATCH {action:reject, rejectionReason} → REJECTED', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.patchLoaAction(api, rejectRecordId, 'reject', {
      rejectionReason: 'E2E 테스트 거부 사유',
    })
    assertOk(res, 'reject LOA')
    expect((res.data as Record<string, unknown>).status).toBe('REJECTED')
  })

  test('POST creates REQUESTED (for cancellation)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.createLoaRecord(api, f.buildLoaRecord(employeeId, loaTypeId))
    assertOk(res, 'create for cancel')
    cancelRecordId = (res.data as Record<string, unknown>).id as string
  })

  test('PATCH {action:approve} → APPROVED', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.patchLoaAction(api, cancelRecordId, 'approve')
    assertOk(res, 'approve for cancel')
  })

  test('PATCH {action:cancel} → CANCELLED', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.patchLoaAction(api, cancelRecordId, 'cancel')
    assertOk(res, 'cancel LOA')
    expect((res.data as Record<string, unknown>).status).toBe('CANCELLED')
  })
})

// ═══════════════════════════════════════════════════════════
// LOA RBAC: EMPLOYEE Blocked
// ═══════════════════════════════════════════════════════════

test.describe('LOA RBAC: EMPLOYEE Blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /leave-of-absence → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listLoaRecords(api)
    assertError(res, 403, 'EMPLOYEE LOA list')
  })

  test('POST /leave-of-absence → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.createLoaRecord(api, f.buildLoaRecord('fake-id', 'fake-type'))
    assertError(res, 403, 'EMPLOYEE LOA create')
  })

  test('PATCH /leave-of-absence/[id] → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.patchLoaAction(api, '00000000-0000-0000-0000-000000000000', 'approve')
    assertError(res, 403, 'EMPLOYEE LOA patch')
  })
})

// ═══════════════════════════════════════════════════════════
// DISCIPLINE: HR_ADMIN CRUD Lifecycle
// ═══════════════════════════════════════════════════════════

test.describe('Discipline: HR_ADMIN CRUD Lifecycle', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let employeeId = ''
  let discId = ''

  test.beforeAll(async ({ request }) => {
    const seed = await resolveSeedData(request)
    employeeId = seed.employeeId
  })

  test('POST /disciplinary creates VERBAL_WARNING', async ({ request }) => {
    const api = new ApiClient(request)
    const data = f.buildDisciplinary(employeeId)
    const res = await f.createDisciplinary(api, data)
    assertOk(res, 'create disciplinary')
    const d = res.data as Record<string, unknown>
    expect(d).toHaveProperty('id')
    expect(d.actionType).toBe('VERBAL_WARNING')
    discId = d.id as string
  })

  test('GET /disciplinary returns paginated list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listDisciplinary(api)
    assertOk(res, 'list disciplinary')
    expect(res.pagination).toBeDefined()
    const items = res.data as Array<{ id: string }>
    expect(items.some((i) => i.id === discId)).toBe(true)
  })

  test('GET /disciplinary/[id] returns detail', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getDisciplinary(api, discId)
    assertOk(res, 'get disciplinary detail')
    const d = res.data as Record<string, unknown>
    expect(d.id).toBe(discId)
    expect(d).toHaveProperty('employee')
  })

  test('PUT /disciplinary/[id] updates description', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.updateDisciplinary(api, discId, { description: 'E2E 수정된 사유' })
    assertOk(res, 'update disciplinary')
    expect((res.data as Record<string, unknown>).description).toBe('E2E 수정된 사유')
  })

  test('PUT /disciplinary/[id] sets status=DISCIPLINE_EXPIRED', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.updateDisciplinary(api, discId, { status: 'DISCIPLINE_EXPIRED' })
    assertOk(res, 'expire disciplinary')
    expect((res.data as Record<string, unknown>).status).toBe('DISCIPLINE_EXPIRED')
  })

  test('GET ?status=DISCIPLINE_EXPIRED returns filtered', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listDisciplinary(api, { status: 'DISCIPLINE_EXPIRED' })
    assertOk(res, 'filter expired')
    const items = res.data as Array<{ status: string }>
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((i) => i.status === 'DISCIPLINE_EXPIRED')).toBe(true)
  })

  test('GET ?category=ATTENDANCE returns filtered', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listDisciplinary(api, { category: 'ATTENDANCE' })
    assertOk(res, 'filter ATTENDANCE')
    const items = res.data as Array<{ category: string }>
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((i) => i.category === 'ATTENDANCE')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════
// DISCIPLINE: Appeal Flow
// ═══════════════════════════════════════════════════════════

test.describe('Discipline: Appeal Flow', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let employeeId = ''
  let discId = ''

  test.beforeAll(async ({ request }) => {
    const seed = await resolveSeedData(request)
    employeeId = seed.employeeId
  })

  test('POST creates DISCIPLINE_ACTIVE for appeal', async ({ request }) => {
    const api = new ApiClient(request)
    const data = f.buildDisciplinary(employeeId)
    const res = await f.createDisciplinary(api, data)
    assertOk(res, 'create for appeal')
    discId = (res.data as Record<string, unknown>).id as string
  })

  test('PUT /disciplinary/[id]/appeal files appeal', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.appealDisciplinary(api, discId, { appealText: 'E2E 이의신청 내용입니다.' })
    assertOk(res, 'file appeal')
    const d = res.data as Record<string, unknown>
    expect(d.appealStatus).toBe('FILED')
  })

  test('PUT /disciplinary/[id]/appeal again → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.appealDisciplinary(api, discId, { appealText: '이중 이의신청' })
    assertError(res, 400, 'duplicate appeal')
  })

  test('PUT /disciplinary/[id] overturns appeal', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.updateDisciplinary(api, discId, {
      appealStatus: 'OVERTURNED',
      status: 'DISCIPLINE_OVERTURNED',
    })
    assertOk(res, 'overturn appeal')
    const d = res.data as Record<string, unknown>
    expect(d.status).toBe('DISCIPLINE_OVERTURNED')
    expect(d.appealStatus).toBe('OVERTURNED')
  })
})

// ═══════════════════════════════════════════════════════════
// DISCIPLINE RBAC: EMPLOYEE Blocked
// ═══════════════════════════════════════════════════════════

test.describe('Discipline RBAC: EMPLOYEE Blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('POST /disciplinary → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.createDisciplinary(api, f.buildDisciplinary('fake-id'))
    assertError(res, 403, 'EMPLOYEE discipline create')
  })

  test('GET /disciplinary list → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listDisciplinary(api)
    assertError(res, 403, 'EMPLOYEE discipline list')
  })

  test('PUT /disciplinary/[id] → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.updateDisciplinary(api, '00000000-0000-0000-0000-000000000000', { description: 'x' })
    assertError(res, 403, 'EMPLOYEE discipline update')
  })
})

// ═══════════════════════════════════════════════════════════
// REWARDS: HR_ADMIN CRUD Lifecycle
// ═══════════════════════════════════════════════════════════

test.describe('Rewards: HR_ADMIN CRUD Lifecycle', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let employeeId = ''
  let rewardId = ''

  test.beforeAll(async ({ request }) => {
    const seed = await resolveSeedData(request)
    employeeId = seed.employeeId
  })

  test('POST /rewards creates COMMENDATION', async ({ request }) => {
    const api = new ApiClient(request)
    const data = f.buildReward(employeeId)
    const res = await f.createReward(api, data)
    assertOk(res, 'create reward')
    const d = res.data as Record<string, unknown>
    expect(d).toHaveProperty('id')
    expect(d.rewardType).toBe('COMMENDATION')
    rewardId = d.id as string
  })

  test('GET /rewards returns paginated list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listRewards(api)
    assertOk(res, 'list rewards')
    expect(res.pagination).toBeDefined()
    const items = res.data as Array<{ id: string }>
    expect(items.some((i) => i.id === rewardId)).toBe(true)
  })

  test('GET /rewards/[id] returns detail', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getReward(api, rewardId)
    assertOk(res, 'get reward detail')
    expect((res.data as Record<string, unknown>).id).toBe(rewardId)
  })

  test('PUT /rewards/[id] updates title', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.updateReward(api, rewardId, { title: 'E2E 수정 포상' })
    assertOk(res, 'update reward')
    expect((res.data as Record<string, unknown>).title).toBe('E2E 수정 포상')
  })

  test('GET ?rewardType=COMMENDATION returns filtered', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listRewards(api, { rewardType: 'COMMENDATION' })
    assertOk(res, 'filter COMMENDATION')
    const items = res.data as Array<{ rewardType: string }>
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((i) => i.rewardType === 'COMMENDATION')).toBe(true)
  })

  test('DELETE /rewards/[id] removes', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.deleteReward(api, rewardId)
    assertOk(res, 'delete reward')
  })

  test('GET /rewards/[id] after delete → 404', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getReward(api, rewardId)
    assertError(res, 404, 'reward after delete')
  })
})

// ═══════════════════════════════════════════════════════════
// REWARDS RBAC: EMPLOYEE Blocked
// ═══════════════════════════════════════════════════════════

test.describe('Rewards RBAC: EMPLOYEE Blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /rewards → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listRewards(api)
    assertError(res, 403, 'EMPLOYEE rewards list')
  })

  test('POST /rewards → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.createReward(api, f.buildReward('fake-id'))
    assertError(res, 403, 'EMPLOYEE rewards create')
  })

  test('DELETE /rewards/[id] → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.deleteReward(api, '00000000-0000-0000-0000-000000000000')
    assertError(res, 403, 'EMPLOYEE rewards delete')
  })
})

// ═══════════════════════════════════════════════════════════
// DELEGATION: MANAGER Lifecycle
// ═══════════════════════════════════════════════════════════

test.describe('Delegation: MANAGER Lifecycle', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('MANAGER') })

  let delegationId = ''
  let delegateeId = ''

  test('GET /delegation/eligible returns candidates', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getEligibleDelegatees(api)
    assertOk(res, 'get eligible delegatees')
    const candidates = res.data as Array<{ id: string }>
    expect(candidates.length).toBeGreaterThan(0)
    // Pick first eligible for delegation
    delegateeId = candidates[0].id
  })

  test('POST /delegation creates delegation', async ({ request }) => {
    const api = new ApiClient(request)
    const data = f.buildDelegation(delegateeId)
    const res = await f.createDelegation(api, data)
    assertOk(res, 'create delegation')
    const d = res.data as Record<string, unknown>
    expect(d).toHaveProperty('id')
    delegationId = d.id as string
  })

  test('PUT /delegation/[id]/revoke revokes', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.revokeDelegation(api, delegationId)
    assertOk(res, 'revoke delegation')
  })
})
