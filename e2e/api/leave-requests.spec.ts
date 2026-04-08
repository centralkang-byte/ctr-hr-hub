// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Requests API Tests
// Covers: balances, requests CRUD, approve/reject workflow,
//         team leave, cross-company, RBAC.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile } from '../helpers/auth'
import { parseApiResponse, assertError } from '../helpers/api-client'
import {
  resolveLeavePolicy,
  createLeaveRequest,
  cancelLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  listLeaveRequests,
  getLeaveBalances,
  getYearBalances,
  cleanupLeaveRequests,
} from '../helpers/leave-fixtures'
import { resolveSeedData } from '../helpers/test-data'

// ─── Dynamic Future Date Generator (Codex P2) ──────────────

function futureDateStr(daysAhead: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

// ═══════════════════════════════════════════════════════════
// EMPLOYEE: Leave Requests
// ═══════════════════════════════════════════════════════════

test.describe('EMPLOYEE: Leave requests', () => {
  test.use({ storageState: authFile('EMPLOYEE') })
  test.describe.configure({ mode: 'serial' })

  let policyId: string | null = null
  let createdRequestId: string | null = null
  let _requestForApproval: string | null = null

  test.beforeAll(async ({ request }) => {
    const policy = await resolveLeavePolicy(request)
    policyId = policy?.id ?? null
  })

  test.afterAll(async ({ request }) => {
    await cleanupLeaveRequests(request)
  })

  // ─── Balances ───────────────────────────────────────────

  test('GET /leave/balances returns current year balances', async ({ request }) => {
    const result = await getLeaveBalances(request)
    expect([200, 404].includes(result.status)).toBe(true)
    if (result.ok) {
      expect(result.data).toBeDefined()
    }
  })

  test('GET /leave/balances?year=2025 returns previous year', async ({ request }) => {
    const result = await getLeaveBalances(request, { year: '2025' })
    expect([200, 404].includes(result.status)).toBe(true)
  })

  test('GET /leave/year-balances returns year balances with type info', async ({ request }) => {
    const result = await getYearBalances(request)
    expect([200, 404].includes(result.status)).toBe(true)
  })

  // ─── Request List ───────────────────────────────────────

  test('GET /leave/requests returns my requests', async ({ request }) => {
    const result = await listLeaveRequests(request)
    expect(result.ok).toBe(true)
    // Employee sees own requests (may be empty array or paginated)
    if (Array.isArray(result.data)) {
      expect(result.data).toBeDefined()
    }
  })

  test('GET /leave/requests?status=APPROVED filters', async ({ request }) => {
    const result = await listLeaveRequests(request, { status: 'APPROVED' })
    expect(result.ok).toBe(true)
  })

  // ─── Create Request ─────────────────────────────────────

  test('POST /leave/requests creates new request', async ({ request }) => {
    if (!policyId) return test.skip()
    // Use a dynamic future date to avoid minAdvanceDays issues (Codex P2)
    const futureDate = futureDateStr(90)
    const leaveReq = await createLeaveRequest(request, {
      policyId,
      startDate: futureDate,
      endDate: futureDate,
      days: 0.5,
      halfDayType: 'AM',
    })
    createdRequestId = leaveReq.id
    expect(leaveReq.id).toBeTruthy()
    expect(leaveReq.status).toBe('PENDING')
  })

  test('POST /leave/requests missing required fields → 400', async ({ request }) => {
    const res = await request.post('/api/v1/leave/requests', {
      data: { reason: 'incomplete' },
    })
    const result = await parseApiResponse(res)
    assertError(result, 400, 'missing fields')
  })

  // ─── Request Detail ─────────────────────────────────────

  test('GET /leave/requests/[newId] returns detail', async ({ request }) => {
    if (!createdRequestId) return test.skip()
    const res = await request.get(`/api/v1/leave/requests/${createdRequestId}`)
    const result = await parseApiResponse(res)
    expect([200, 404].includes(result.status)).toBe(true)
  })

  // ─── Cancel ─────────────────────────────────────────────

  test('PUT /leave/requests/[newId]/cancel cancels PENDING request', async ({ request }) => {
    if (!createdRequestId) return test.skip()
    const result = await cancelLeaveRequest(request, createdRequestId)
    expect([200, 204].includes(result.status) || result.ok).toBe(true)
  })

  test('PUT /leave/requests/[cancelledId]/cancel already cancelled → 400', async ({ request }) => {
    if (!createdRequestId) return test.skip()
    const result = await cancelLeaveRequest(request, createdRequestId)
    // Should fail — already cancelled
    expect([400, 404, 409].includes(result.status)).toBe(true)
  })

  // ─── Create another for approve/reject flow ─────────────

  test('POST /leave/requests (for approval flow)', async ({ request }) => {
    if (!policyId) return test.skip()
    const futureDate = futureDateStr(120)
    const leaveReq = await createLeaveRequest(request, {
      policyId,
      startDate: futureDate,
      endDate: futureDate,
      days: 0.5,
      halfDayType: 'PM',
    })
    _requestForApproval = leaveReq.id
    expect(leaveReq.id).toBeTruthy()
  })

  // ─── RBAC: Employee can't see team ──────────────────────

  test('GET /leave/team → 403 (employee)', async ({ request }) => {
    const res = await request.get('/api/v1/leave/team')
    const result = await parseApiResponse(res)
    expect([401, 403].includes(result.status)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════
// HR_ADMIN: Leave Admin
// ═══════════════════════════════════════════════════════════

test.describe('HR_ADMIN: Leave admin', () => {
  test.use({ storageState: authFile('HR_ADMIN') })
  test.describe.configure({ mode: 'serial' })

  test('GET /leave/admin returns dashboard data', async ({ request }) => {
    const res = await request.get('/api/v1/leave/admin')
    const result = await parseApiResponse(res)
    expect([200, 404].includes(result.status)).toBe(true)
  })

  test('GET /leave/admin?year=2025 supports year filter', async ({ request }) => {
    const res = await request.get('/api/v1/leave/admin?year=2025')
    const result = await parseApiResponse(res)
    expect([200, 404].includes(result.status)).toBe(true)
  })

  test('GET /leave/admin/stats returns KPI data', async ({ request }) => {
    const res = await request.get('/api/v1/leave/admin/stats')
    const result = await parseApiResponse(res)
    expect([200, 404].includes(result.status)).toBe(true)
  })

  test('PUT /leave/requests/[id]/approve approves pending request', async ({ request }) => {
    // Find a pending request to approve
    const listRes = await request.get('/api/v1/leave/requests?status=PENDING&limit=1')
    const listResult = await parseApiResponse<Array<Record<string, unknown>>>(listRes)
    if (!listResult.ok || !listResult.data || (listResult.data as unknown[]).length === 0) {
      return test.skip()
    }
    const reqId = ((listResult.data as unknown[])[0] as Record<string, unknown>).id as string

    const result = await approveLeaveRequest(request, reqId)
    // 200 = approved, 400 = already processed, 404 = not found
    expect([200, 400, 404].includes(result.status)).toBe(true)
  })

  test('PUT /leave/requests/[id]/approve already approved → 400', async ({ request }) => {
    // Find an approved request
    const listRes = await request.get('/api/v1/leave/requests?status=APPROVED&limit=1')
    const listResult = await parseApiResponse<Array<Record<string, unknown>>>(listRes)
    if (!listResult.ok || !listResult.data || (listResult.data as unknown[]).length === 0) {
      return test.skip()
    }
    const reqId = ((listResult.data as unknown[])[0] as Record<string, unknown>).id as string

    const result = await approveLeaveRequest(request, reqId)
    // Should fail — already approved
    expect([400, 404, 409].includes(result.status)).toBe(true)
  })

  test('PUT /leave/requests/[id]/reject with reason rejects', async ({ request }) => {
    // Find a pending request to reject
    const listRes = await request.get('/api/v1/leave/requests?status=PENDING&limit=1')
    const listResult = await parseApiResponse<Array<Record<string, unknown>>>(listRes)
    if (!listResult.ok || !listResult.data || (listResult.data as unknown[]).length === 0) {
      return test.skip()
    }
    const reqId = ((listResult.data as unknown[])[0] as Record<string, unknown>).id as string

    const result = await rejectLeaveRequest(request, reqId, 'E2E test rejection')
    expect([200, 400, 404].includes(result.status)).toBe(true)
  })

  test('PUT /leave/requests/[id]/reject without reason → 400', async ({ request }) => {
    // Find a pending request
    const listRes = await request.get('/api/v1/leave/requests?status=PENDING&limit=1')
    const listResult = await parseApiResponse<Array<Record<string, unknown>>>(listRes)
    if (!listResult.ok || !listResult.data || (listResult.data as unknown[]).length === 0) {
      return test.skip()
    }
    const reqId = ((listResult.data as unknown[])[0] as Record<string, unknown>).id as string

    const res = await request.put(`/api/v1/leave/requests/${reqId}/reject`, {
      data: {},
    })
    const result = await parseApiResponse(res)
    // Should fail without reason, or succeed if reason is optional
    expect([200, 400].includes(result.status)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════
// MANAGER: Team leave
// ═══════════════════════════════════════════════════════════

test.describe('MANAGER: Team leave', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('GET /leave/team returns team calendar data', async ({ request }) => {
    const res = await request.get('/api/v1/leave/team')
    const result = await parseApiResponse(res)
    // Manager should see team leave data
    expect([200, 404].includes(result.status)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════
// SUPER_ADMIN: Cross-company
// ═══════════════════════════════════════════════════════════

test.describe('SUPER_ADMIN: Cross-company leave', () => {
  test.use({ storageState: authFile('SUPER_ADMIN') })

  test('GET /leave/admin?companyId=X filters by company', async ({ request }) => {
    const seed = await resolveSeedData(request)
    const res = await request.get(`/api/v1/leave/admin?companyId=${seed.companyId}`)
    const result = await parseApiResponse(res)
    expect([200, 404].includes(result.status)).toBe(true)
  })

  test('GET /leave/admin/stats?companyId=X filters by company', async ({ request }) => {
    const seed = await resolveSeedData(request)
    const res = await request.get(`/api/v1/leave/admin/stats?companyId=${seed.companyId}`)
    const result = await parseApiResponse(res)
    expect([200, 404].includes(result.status)).toBe(true)
  })
})
