// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Event-Based (Non-Accruing) Leave E2E
// 경조사·특별휴가 등 잔액 미추적 휴가의 신청/승인/반려 생명주기.
// Regression: special-leave create used to 400 ("잔여일이 없습니다").
// Covers N2 role-based: EMPLOYEE files, HR_ADMIN approves/rejects.
// ═══════════════════════════════════════════════════════════

import { test, expect, type APIRequestContext } from '@playwright/test'
import { authFile } from '../helpers/auth'
import { parseApiResponse } from '../helpers/api-client'
import { createLeaveRequest, cleanupLeaveRequests } from '../helpers/leave-fixtures'

// ─── Helpers ────────────────────────────────────────────────

/** Future date bumped to a weekday (business_day counting yields >= 1). */
function futureWeekday(daysAhead: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  const day = d.getDay()
  if (day === 6) d.setDate(d.getDate() + 2) // Sat → Mon
  else if (day === 0) d.setDate(d.getDate() + 1) // Sun → Mon
  return d.toISOString().slice(0, 10)
}

function plusDays(base: string, n: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Next Saturday on/after daysAhead — a non-working day for business_day counting. */
function nextSaturday(daysAhead: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7)) // advance to Saturday
  return d.toISOString().slice(0, 10)
}

interface PolicyLite {
  id: string
  name: string
  defaultDays: number
}

/** Resolve the first policy of a given leaveType for the session's company. */
async function resolvePolicyByType(
  request: APIRequestContext,
  leaveType: string,
): Promise<PolicyLite | null> {
  const res = await request.get(`/api/v1/leave/policies?limit=50&leaveType=${leaveType}`)
  const r = await parseApiResponse<Array<Record<string, unknown>>>(res)
  if (!r.ok || !Array.isArray(r.data) || r.data.length === 0) return null
  const p = r.data[0] as Record<string, unknown>
  return {
    id: p.id as string,
    name: (p.name ?? '') as string,
    defaultDays: Number(p.defaultDays ?? 0),
  }
}

// ═══════════════════════════════════════════════════════════
// EMPLOYEE: file event-based special leave
// ═══════════════════════════════════════════════════════════

test.describe('EMPLOYEE: event-based special leave', () => {
  test.use({ storageState: authFile('EMPLOYEE') })
  test.describe.configure({ mode: 'serial' })

  let special: PolicyLite | null = null
  let sick: PolicyLite | null = null

  test.beforeAll(async ({ request }) => {
    special = await resolvePolicyByType(request, 'SPECIAL')
    sick = await resolvePolicyByType(request, 'SICK')
  })

  test.afterAll(async ({ request }) => {
    await cleanupLeaveRequests(request)
  })

  // THE regression: special leave (no LeaveYearBalance row) must now create, not 400.
  test('POST special leave creates PENDING (was 400: 잔여일이 없습니다)', async ({ request }) => {
    if (!special) return test.skip()
    const day = futureWeekday(75)
    const leaveReq = await createLeaveRequest(request, {
      policyId: special.id,
      startDate: day,
      endDate: day,
      days: 1,
      reason: '본인 결혼 (E2E)',
    })
    expect(leaveReq.id).toBeTruthy()
    expect(leaveReq.status).toBe('PENDING')
  })

  // H1 cap: event leave is bounded by policy-defined days (maxConsecutiveDays ?? defaultDays).
  test('POST special leave exceeding policy days → 400', async ({ request }) => {
    if (!special) return test.skip()
    if (!special.defaultDays || special.defaultDays >= 365) return test.skip()
    const start = futureWeekday(80)
    const end = plusDays(start, 21) // ~15 business days ≫ defaultDays(=3)
    const res = await request.post('/api/v1/leave/requests', {
      data: {
        policyId: special.id,
        startDate: start,
        endDate: end,
        days: 16,
        reason: 'over-cap (E2E)',
      },
    })
    const result = await parseApiResponse(res)
    expect(result.status).toBe(400)
  })

  // Same fix covers 병가 (sick) — also non-accruing, also used to 400.
  test('POST sick leave creates PENDING (non-accruing)', async ({ request }) => {
    if (!sick) return test.skip()
    const day = futureWeekday(77)
    const leaveReq = await createLeaveRequest(request, {
      policyId: sick.id,
      startDate: day,
      endDate: day,
      days: 1,
      reason: '병가 (E2E)',
    })
    expect(leaveReq.id).toBeTruthy()
    expect(leaveReq.status).toBe('PENDING')
  })

  // 0-day guard: a weekend-only request on a business_day type computes 0 days → 400.
  test('POST special leave on a non-working day (0 days) → 400', async ({ request }) => {
    if (!special) return test.skip()
    const sat = nextSaturday(80)
    const res = await request.post('/api/v1/leave/requests', {
      data: { policyId: special.id, startDate: sat, endDate: sat, days: 1, reason: 'weekend (E2E)' },
    })
    const result = await parseApiResponse(res)
    expect(result.status).toBe(400)
  })

  // RBAC: employee lacks LEAVE.UPDATE → cannot approve.
  test('PUT approve as EMPLOYEE → 401/403', async ({ request }) => {
    const res = await request.put(
      '/api/v1/leave/requests/00000000-0000-0000-0000-000000000000/approve',
    )
    const result = await parseApiResponse(res)
    expect([401, 403].includes(result.status)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════
// HR_ADMIN: approve / reject event-based special leave
// ═══════════════════════════════════════════════════════════

test.describe('HR_ADMIN: approve/reject event-based special leave', () => {
  test.use({ storageState: authFile('HR_ADMIN') })
  test.describe.configure({ mode: 'serial' })

  let special: PolicyLite | null = null

  test.beforeAll(async ({ request }) => {
    special = await resolvePolicyByType(request, 'SPECIAL')
  })

  test.afterAll(async ({ request }) => {
    await cleanupLeaveRequests(request)
  })

  // Event approve: no balance deduction, status → APPROVED.
  test('approve special leave (no balance) → APPROVED', async ({ request }) => {
    if (!special) return test.skip()
    const day = futureWeekday(90)
    const created = await createLeaveRequest(request, {
      policyId: special.id,
      startDate: day,
      endDate: day,
      days: 1,
      reason: '부모 사망 (E2E approve)',
    })

    const res = await request.put(`/api/v1/leave/requests/${created.id}/approve`)
    const result = await parseApiResponse<{ request?: { status?: string } }>(res)
    expect(result.status).toBe(200)
    expect(result.data?.request?.status).toBe('APPROVED')

    // Idempotency: second approve on the now-APPROVED request must fail.
    const again = await request.put(`/api/v1/leave/requests/${created.id}/approve`)
    const againResult = await parseApiResponse(again)
    expect([400, 404].includes(againResult.status)).toBe(true)
  })

  // Event reject: no pending restore, status → REJECTED.
  test('reject special leave (no balance) → REJECTED', async ({ request }) => {
    if (!special) return test.skip()
    const day = futureWeekday(95)
    const created = await createLeaveRequest(request, {
      policyId: special.id,
      startDate: day,
      endDate: day,
      days: 1,
      reason: '경조사 (E2E reject)',
    })

    const res = await request.put(`/api/v1/leave/requests/${created.id}/reject`, {
      data: { rejectionReason: '서류 미비 (E2E)' },
    })
    const result = await parseApiResponse<{ request?: { status?: string } }>(res)
    expect(result.status).toBe(200)
    expect(result.data?.request?.status).toBe('REJECTED')
  })
})
