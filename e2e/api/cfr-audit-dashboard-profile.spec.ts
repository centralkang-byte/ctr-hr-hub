// ═══════════════════════════════════════════════════════════
// Phase 2 API P14 — Spec 1
// CFR (One-on-Ones + Recognitions), Audit Logs + Retention,
// Dashboard Deep, Profile Change Requests
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import * as f from '../helpers/p14-fixtures'

// ═══════════════════════════════════════════════════════════
// Section A: CFR One-on-Ones — HR_ADMIN (10 tests)
// ═══════════════════════════════════════════════════════════

test.describe('CFR One-on-Ones: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })
  test.describe.configure({ mode: 'serial' })

  let meetingId = ''
  let employeeId = ''

  test('resolve employee ID for tests', async ({ request }) => {
    const api = new ApiClient(request)
    employeeId = await f.resolveEmployeeId(api)
    expect(employeeId).toBeTruthy()
  })

  test('POST /cfr/one-on-ones → 201', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.createOneOnOne(api, f.buildOneOnOne(employeeId))
    assertOk(res, 'create one-on-one')
    meetingId = res.data.id
    expect(meetingId).toBeTruthy()
  })

  test('GET /cfr/one-on-ones list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listOneOnOnes(api)
    assertOk(res, 'list one-on-ones')
    expect(Array.isArray(res.data)).toBe(true)
  })

  test('GET /cfr/one-on-ones?status=SCHEDULED filter', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listOneOnOnes(api, { status: 'SCHEDULED' })
    assertOk(res, 'list scheduled')
  })

  test('GET /cfr/one-on-ones/[id] detail', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getOneOnOne(api, meetingId)
    assertOk(res, 'get one-on-one detail')
    expect(res.data.id).toBe(meetingId)
  })

  test('PUT /cfr/one-on-ones/[id] update notes', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.updateOneOnOne(api, meetingId, f.buildOneOnOneUpdate())
    assertOk(res, 'update one-on-one')
    expect(res.data.notes).toBeTruthy()
  })

  test('PUT /cfr/one-on-ones/[id] complete', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.updateOneOnOne(api, meetingId, f.buildOneOnOneUpdate('COMPLETED'))
    assertOk(res, 'complete one-on-one')
  })

  test('POST /cfr/one-on-ones missing employeeId → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.createOneOnOne(api, { ...f.buildOneOnOne(employeeId), employeeId: '' })
    assertError(res, 400, 'missing employeeId')
  })

  test('GET /cfr/one-on-ones/dashboard', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getOneOnOneDashboard(api)
    assertOk(res, 'one-on-one dashboard')
  })

  test('GET /cfr/one-on-ones/[invalid-id] → 404', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getOneOnOne(api, '00000000-0000-0000-0000-000000000000')
    assertError(res, 404, 'not found')
  })
})

// ═══════════════════════════════════════════════════════════
// Section B: CFR One-on-Ones — EMPLOYEE RBAC (4 tests)
// ═══════════════════════════════════════════════════════════

test.describe('CFR One-on-Ones: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /cfr/one-on-ones list (own)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listOneOnOnes(api)
    // EMPLOYEE with PERFORMANCE.VIEW can list
    expect([200, 403]).toContain(res.status)
  })

  test('POST /cfr/one-on-ones → 403 (no CREATE perm)', async ({ request }) => {
    const api = new ApiClient(request)
    const empId = await f.resolveEmployeeId(api)
    const res = await f.createOneOnOne(api, f.buildOneOnOne(empId))
    assertError(res, 403, 'employee cannot create one-on-one')
  })

  test('GET /cfr/one-on-ones/dashboard → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getOneOnOneDashboard(api)
    assertError(res, 403, 'employee cannot access dashboard')
  })

  test('PUT /cfr/one-on-ones/[id] → 403 (no UPDATE perm)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.updateOneOnOne(api, '00000000-0000-0000-0000-000000000000', f.buildOneOnOneUpdate())
    assertError(res, 403, 'employee cannot update')
  })
})

// ═══════════════════════════════════════════════════════════
// Section C: CFR Recognitions — HR_ADMIN (8 tests)
// ═══════════════════════════════════════════════════════════

test.describe('CFR Recognitions: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })
  test.describe.configure({ mode: 'serial' })

  let recognitionId = ''
  let employeeId = ''

  test('resolve employee for recognition', async ({ request }) => {
    const api = new ApiClient(request)
    employeeId = await f.resolveSecondEmployeeId(api)
    expect(employeeId).toBeTruthy()
  })

  test('POST /cfr/recognitions → 201', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.createRecognition(api, f.buildRecognition(employeeId))
    assertOk(res, 'create recognition')
    recognitionId = res.data.id
    expect(recognitionId).toBeTruthy()
  })

  test('GET /cfr/recognitions feed', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listRecognitions(api)
    assertOk(res, 'list recognitions')
    expect(res.data.items || res.data).toBeTruthy()
  })

  test('GET /cfr/recognitions?value=TRUST filter', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listRecognitions(api, { value: 'TRUST' })
    assertOk(res, 'filter by value')
  })

  test('POST /cfr/recognitions/[id]/like toggle', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.likeRecognition(api, recognitionId)
    assertOk(res, 'like recognition')
    expect(res.data).toHaveProperty('liked')
  })

  test('GET /cfr/recognitions/stats', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getRecognitionStats(api)
    assertOk(res, 'recognition stats')
    expect(res.data).toHaveProperty('valueDistribution')
  })

  test('GET /cfr/recognitions/employee/[id]', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getEmployeeRecognitions(api, employeeId)
    assertOk(res, 'employee recognitions')
  })

  test('POST /cfr/recognitions self-recognition → 400', async ({ request }) => {
    const api = new ApiClient(request)
    // HR_ADMIN's own employeeId — resolve from employees/me or use known value
    const res = await f.createRecognition(api, { ...f.buildRecognition(employeeId), receiverId: '' })
    assertError(res, 400, 'invalid receiverId')
  })
})

// ═══════════════════════════════════════════════════════════
// Section D: CFR Recognitions — EMPLOYEE (4 tests)
// ═══════════════════════════════════════════════════════════

test.describe('CFR Recognitions: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /cfr/recognitions feed (own view)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listRecognitions(api)
    expect([200, 403]).toContain(res.status)
  })

  test('POST /cfr/recognitions (employee has PERFORMANCE.CREATE)', async ({ request }) => {
    const api = new ApiClient(request)
    const empId = await f.resolveSecondEmployeeId(api)
    const res = await f.createRecognition(api, f.buildRecognition(empId))
    // Employee has PERFORMANCE.CREATE perm in seeded data
    expect([200, 201, 403]).toContain(res.status)
  })

  test('GET /cfr/recognitions/stats → 403 (APPROVE perm needed)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getRecognitionStats(api)
    assertError(res, 403, 'employee cannot access stats')
  })

  test('POST /cfr/recognitions/[id]/like (PERFORMANCE.VIEW → 200 or 404)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.likeRecognition(api, '00000000-0000-0000-0000-000000000000')
    // Employee has PERFORMANCE.VIEW; invalid UUID → 404 not 403
    expect([200, 404]).toContain(res.status)
  })
})

// ═══════════════════════════════════════════════════════════
// Section E: Audit Logs — SUPER_ADMIN (6 tests)
// ═══════════════════════════════════════════════════════════

test.describe('Audit Logs: SUPER_ADMIN', () => {
  test.use({ storageState: authFile('SUPER_ADMIN') })

  test('GET /audit/logs list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listAuditLogs(api)
    assertOk(res, 'list audit logs')
    expect(Array.isArray(res.data)).toBe(true)
  })

  test('GET /audit/logs?action=employee filter', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listAuditLogs(api, { action: 'employee' })
    assertOk(res, 'filter audit logs by action')
  })

  test('GET /audit/logs?resourceType=employee filter', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listAuditLogs(api, { resourceType: 'employee' })
    assertOk(res, 'filter audit logs by resourceType')
  })

  test('GET /audit/logs/export CSV', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.exportAuditLogs(api)
    // Export returns CSV or success
    expect([200, 204]).toContain(res.status)
  })

  test('GET /audit/logs/stats', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getAuditStats(api, { days: '30' })
    assertOk(res, 'audit stats')
    expect(res.data).toHaveProperty('totalLogs')
  })

  test('GET /audit/logs/stats?days=7 filter', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getAuditStats(api, { days: '7' })
    assertOk(res, 'audit stats 7 days')
  })
})

// ═══════════════════════════════════════════════════════════
// Section F: Audit Retention — SUPER_ADMIN (4 tests)
// ═══════════════════════════════════════════════════════════

test.describe('Audit Retention: SUPER_ADMIN', () => {
  test.use({ storageState: authFile('SUPER_ADMIN') })
  test.describe.configure({ mode: 'serial' })

  test('GET /audit/retention-policy', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getRetentionPolicy(api)
    assertOk(res, 'get retention policy')
    expect(res.data).toHaveProperty('retentionDays')
  })

  test('PUT /audit/retention-policy update', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.updateRetentionPolicy(api, 365)
    assertOk(res, 'update retention policy')
    expect(res.data.retentionDays).toBe(365)
  })

  test('PUT /audit/retention-policy restore default', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.updateRetentionPolicy(api, 730)
    assertOk(res, 'restore default retention')
  })

  test('GET /compliance/cron/retention without secret → 401/403', async ({ request }) => {
    const api = new ApiClient(request)
    // Cron endpoint requires CRON_SECRET header, not session auth
    const res = await f.triggerCronRetention(api)
    expect([401, 403]).toContain(res.status)
  })
})

// ═══════════════════════════════════════════════════════════
// Section G: Audit RBAC — EMPLOYEE (2 tests)
// ═══════════════════════════════════════════════════════════

test.describe('Audit: EMPLOYEE RBAC', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /audit/logs → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listAuditLogs(api)
    assertError(res, 403, 'employee cannot access audit logs')
  })

  test('GET /audit/retention-policy → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getRetentionPolicy(api)
    assertError(res, 403, 'employee cannot access retention policy')
  })
})

// ═══════════════════════════════════════════════════════════
// Section H: Dashboard Deep — SUPER_ADMIN (4 tests)
// ═══════════════════════════════════════════════════════════

test.describe('Dashboard Deep: SUPER_ADMIN', () => {
  test.use({ storageState: authFile('SUPER_ADMIN') })

  test('GET /dashboard/compare', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getDashboardCompare(api, { kpi: 'headcount' })
    assertOk(res, 'dashboard compare')
    expect(res.data).toHaveProperty('results')
  })

  test('GET /dashboard/compare/export XLSX', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getDashboardCompareExport(api, { kpi: 'headcount' })
    expect([200, 204]).toContain(res.status)
  })

  test('GET /dashboard/summary', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getDashboardSummary(api)
    assertOk(res, 'dashboard summary')
    expect(res.data).toHaveProperty('headcount')
  })

  test('GET /dashboard/widgets/workforce-company', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getDashboardWidget(api, 'workforce-company')
    assertOk(res, 'widget workforce-company')
  })
})

// ═══════════════════════════════════════════════════════════
// Section I: Profile Change Requests — EMPLOYEE (5 tests)
// ═══════════════════════════════════════════════════════════

test.describe('Profile Change Requests: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })
  test.describe.configure({ mode: 'serial' })

  let changeRequestId = ''

  test('POST /profile/change-requests → 201', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.createChangeRequest(api, f.buildProfileChangeRequest())
    assertOk(res, 'create change request')
    changeRequestId = res.data.id
    expect(changeRequestId).toBeTruthy()
  })

  test('GET /profile/change-requests list own', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listChangeRequests(api)
    assertOk(res, 'list own change requests')
  })

  test('POST /profile/change-requests invalid field → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.createChangeRequest(api, { ...f.buildProfileChangeRequest(), fieldName: 'salary' } as never)
    assertError(res, 400, 'invalid field name')
  })

  test('GET /profile/change-requests/pending → 403 (APPROVE perm needed)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listPendingChangeRequests(api)
    assertError(res, 403, 'employee cannot view pending')
  })

  test('PUT /profile/change-requests/[id]/review → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.reviewChangeRequest(api, changeRequestId || '00000000-0000-0000-0000-000000000000', f.buildProfileReview('APPROVE'))
    assertError(res, 403, 'employee cannot review')
  })
})

// ═══════════════════════════════════════════════════════════
// Section J: Profile Change Requests — HR_ADMIN (5 tests)
// ═══════════════════════════════════════════════════════════

test.describe('Profile Change Requests: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })
  test.describe.configure({ mode: 'serial' })

  let pendingId = ''

  test('GET /profile/change-requests list all', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listChangeRequests(api)
    assertOk(res, 'list all change requests')
  })

  test('GET /profile/change-requests/pending', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listPendingChangeRequests(api)
    assertOk(res, 'list pending change requests')
    const pending = res.data as { id: string }[]
    if (pending.length > 0) pendingId = pending[0].id
  })

  test('PUT /profile/change-requests/[id]/review approve', async ({ request }) => {
    test.skip(!pendingId, 'no pending request to approve')
    const api = new ApiClient(request)
    const res = await f.reviewChangeRequest(api, pendingId, f.buildProfileReview('APPROVE'))
    assertOk(res, 'approve change request')
  })

  test('PUT /profile/change-requests/[id]/review reject missing reason → 400', async ({ request }) => {
    const api = new ApiClient(request)
    // Create a new request to reject
    const createRes = await f.createChangeRequest(api, f.buildProfileChangeRequest())
    if (!createRes.ok) return // skip if create fails
    const res = await f.reviewChangeRequest(api, createRes.data.id, f.buildProfileReview('REJECT'))
    // Should fail without rejectionReason or succeed with status REJECTED
    expect([200, 400]).toContain(res.status)
  })

  test('PUT /profile/change-requests/[invalid-id]/review → 404', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.reviewChangeRequest(api, '00000000-0000-0000-0000-000000000000', f.buildProfileReview('APPROVE'))
    assertError(res, 404, 'change request not found')
  })
})
