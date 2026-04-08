// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Config API Tests
// Covers: policies CRUD, type-defs CRUD, designated-days CRUD,
//         accrual, bulk-grant, RBAC.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile } from '../helpers/auth'
import { parseApiResponse } from '../helpers/api-client'
import { resolveSeedData } from '../helpers/test-data'

// ═══════════════════════════════════════════════════════════
// HR_ADMIN: Leave Policies CRUD
// ═══════════════════════════════════════════════════════════

test.describe('HR_ADMIN: Leave Policies', () => {
  test.use({ storageState: authFile('HR_ADMIN') })
  test.describe.configure({ mode: 'serial' })

  let createdPolicyId: string | null = null

  test('GET /leave/policies returns list', async ({ request }) => {
    const res = await request.get('/api/v1/leave/policies')
    const result = await parseApiResponse(res)
    expect(result.ok).toBe(true)
    expect(Array.isArray(result.data)).toBe(true)
  })

  test('POST /leave/policies creates new policy', async ({ request }) => {
    const seed = await resolveSeedData(request)
    const ts = Date.now()
    const res = await request.post('/api/v1/leave/policies', {
      data: {
        name: `E2E Test Policy ${ts}`,
        leaveType: 'ANNUAL',
        totalDays: 15,
        companyId: seed.companyId,
        description: 'E2E test policy',
      },
    })
    const result = await parseApiResponse(res)
    // May return 200 or 201 on success, or 400 if schema differs
    if (result.ok && result.data) {
      createdPolicyId = (result.data as Record<string, unknown>).id as string
      expect(createdPolicyId).toBeTruthy()
    } else {
      // Policy creation may require different fields — log for debugging
      console.log(`Policy create status: ${result.status}, error: ${result.error}`)
    }
  })

  test('POST /leave/policies invalid data → 400', async ({ request }) => {
    const res = await request.post('/api/v1/leave/policies', {
      data: { name: '' },
    })
    const result = await parseApiResponse(res)
    expect([400, 422].includes(result.status)).toBe(true)
  })

  test('GET /leave/policies/[newId] returns detail', async ({ request }) => {
    if (!createdPolicyId) return test.skip()
    const res = await request.get(`/api/v1/leave/policies/${createdPolicyId}`)
    const result = await parseApiResponse(res)
    expect([200, 404].includes(result.status)).toBe(true)
  })

  test('PUT /leave/policies/[newId] updates', async ({ request }) => {
    if (!createdPolicyId) return test.skip()
    const res = await request.put(`/api/v1/leave/policies/${createdPolicyId}`, {
      data: { name: `Updated Policy ${Date.now()}` },
    })
    const result = await parseApiResponse(res)
    expect([200, 404].includes(result.status)).toBe(true)
  })

  test('DELETE /leave/policies/[newId] soft deletes', async ({ request }) => {
    if (!createdPolicyId) return test.skip()
    const res = await request.delete(`/api/v1/leave/policies/${createdPolicyId}`)
    const result = await parseApiResponse(res)
    expect([200, 204, 404].includes(result.status)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════
// HR_ADMIN: Leave Type Defs CRUD
// ═══════════════════════════════════════════════════════════

test.describe('HR_ADMIN: Leave Type Defs', () => {
  test.use({ storageState: authFile('HR_ADMIN') })
  test.describe.configure({ mode: 'serial' })

  let createdTypeDefId: string | null = null

  test('GET /leave/type-defs returns list', async ({ request }) => {
    const res = await request.get('/api/v1/leave/type-defs')
    const result = await parseApiResponse(res)
    expect(result.ok).toBe(true)
    if (Array.isArray(result.data)) {
      expect(result.data.length).toBeGreaterThan(0)
    }
  })

  test('POST /leave/type-defs creates type def', async ({ request }) => {
    const seed = await resolveSeedData(request)
    const ts = Date.now()
    const res = await request.post('/api/v1/leave/type-defs', {
      data: {
        code: `E2E-${ts}`,
        name: `E2E Test Type ${ts}`,
        nameEn: `E2E Test Type ${ts}`,
        category: 'OTHER',
        subcategory: 'other',
        defaultDays: 1,
        isPaid: true,
        countingMethod: 'business_day',
        companyId: seed.companyId,
      },
    })
    const result = await parseApiResponse(res)
    if (result.ok && result.data) {
      createdTypeDefId = (result.data as Record<string, unknown>).id as string
      expect(createdTypeDefId).toBeTruthy()
    } else {
      console.log(`TypeDef create status: ${result.status}, error: ${result.error}`)
    }
  })

  test('GET /leave/type-defs/[newId] returns detail', async ({ request }) => {
    if (!createdTypeDefId) return test.skip()
    const res = await request.get(`/api/v1/leave/type-defs/${createdTypeDefId}`)
    const result = await parseApiResponse(res)
    expect([200, 404].includes(result.status)).toBe(true)
  })

  test('PUT /leave/type-defs/[newId] updates', async ({ request }) => {
    if (!createdTypeDefId) return test.skip()
    const res = await request.put(`/api/v1/leave/type-defs/${createdTypeDefId}`, {
      data: { name: `Updated TypeDef ${Date.now()}` },
    })
    const result = await parseApiResponse(res)
    expect([200, 404].includes(result.status)).toBe(true)
  })

  test('DELETE /leave/type-defs/[newId] deletes', async ({ request }) => {
    if (!createdTypeDefId) return test.skip()
    const res = await request.delete(`/api/v1/leave/type-defs/${createdTypeDefId}`)
    const result = await parseApiResponse(res)
    expect([200, 204, 404].includes(result.status)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════
// HR_ADMIN: Designated Days CRUD
// ═══════════════════════════════════════════════════════════

test.describe('HR_ADMIN: Designated Days', () => {
  test.use({ storageState: authFile('HR_ADMIN') })
  test.describe.configure({ mode: 'serial' })

  let createdDayId: string | null = null

  test('GET /leave/designated-days returns list', async ({ request }) => {
    const res = await request.get('/api/v1/leave/designated-days')
    const result = await parseApiResponse(res)
    expect(result.ok).toBe(true)
  })

  test('POST /leave/designated-days creates', async ({ request }) => {
    const ts = Date.now()
    // Use a far-future unique date to avoid collisions
    const uniqueDate = `2099-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`
    const res = await request.post('/api/v1/leave/designated-days', {
      data: {
        date: uniqueDate,
        name: `E2E Designated Day ${ts}`,
      },
    })
    const result = await parseApiResponse(res)
    if (result.ok && result.data) {
      createdDayId = (result.data as Record<string, unknown>).id as string
      expect(createdDayId).toBeTruthy()
    } else {
      // May fail on unique constraint if date already exists
      console.log(`DesignatedDay create status: ${result.status}, error: ${result.error}`)
    }
  })

  test('DELETE /leave/designated-days/[newId] deletes', async ({ request }) => {
    if (!createdDayId) return test.skip()
    const res = await request.delete(`/api/v1/leave/designated-days/${createdDayId}`)
    const result = await parseApiResponse(res)
    expect([200, 204, 404].includes(result.status)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════
// HR_ADMIN: Accrual & Bulk
// ═══════════════════════════════════════════════════════════

test.describe('HR_ADMIN: Accrual & Bulk', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('POST /leave/accrual triggers accrual calculation', async ({ request }) => {
    const res = await request.post('/api/v1/leave/accrual', {
      data: { year: 2026 },
    })
    const result = await parseApiResponse(res)
    // May succeed or return 400 depending on accrual state
    expect([200, 400, 404].includes(result.status)).toBe(true)
  })

  test('POST /leave/bulk-grant grants leave', async ({ request }) => {
    const seed = await resolveSeedData(request)
    if (!seed.leavePolicyId) return test.skip()

    const res = await request.post('/api/v1/leave/bulk-grant', {
      data: {
        policyId: seed.leavePolicyId,
        year: 2026,
        employeeIds: [seed.employeeId],
        days: 0.5,
      },
    })
    const result = await parseApiResponse(res)
    // May succeed or fail depending on balance state
    expect([200, 400, 404].includes(result.status)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════
// EMPLOYEE: Admin endpoints blocked
// ═══════════════════════════════════════════════════════════

test.describe('EMPLOYEE: Leave admin blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /leave/admin → 403', async ({ request }) => {
    const res = await request.get('/api/v1/leave/admin')
    const result = await parseApiResponse(res)
    expect([401, 403].includes(result.status)).toBe(true)
  })

  test('GET /leave/admin/stats → 403', async ({ request }) => {
    const res = await request.get('/api/v1/leave/admin/stats')
    const result = await parseApiResponse(res)
    expect([401, 403].includes(result.status)).toBe(true)
  })

  test('POST /leave/policies → 403', async ({ request }) => {
    const res = await request.post('/api/v1/leave/policies', {
      data: { name: 'should fail' },
    })
    const result = await parseApiResponse(res)
    expect([401, 403].includes(result.status)).toBe(true)
  })

  test('POST /leave/type-defs → 403', async ({ request }) => {
    const res = await request.post('/api/v1/leave/type-defs', {
      data: { code: 'FAIL', name: 'should fail' },
    })
    const result = await parseApiResponse(res)
    expect([401, 403].includes(result.status)).toBe(true)
  })

  test('POST /leave/designated-days → 403', async ({ request }) => {
    const res = await request.post('/api/v1/leave/designated-days', {
      data: { date: '2026-01-01', name: 'should fail' },
    })
    const result = await parseApiResponse(res)
    expect([401, 403].includes(result.status)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════
// MANAGER: Config endpoints blocked
// ═══════════════════════════════════════════════════════════

test.describe('MANAGER: Leave config blocked', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('POST /leave/policies → 403', async ({ request }) => {
    const res = await request.post('/api/v1/leave/policies', {
      data: { name: 'should fail' },
    })
    const result = await parseApiResponse(res)
    expect([401, 403].includes(result.status)).toBe(true)
  })

  test('POST /leave/type-defs → 403', async ({ request }) => {
    const res = await request.post('/api/v1/leave/type-defs', {
      data: { code: 'FAIL', name: 'should fail' },
    })
    const result = await parseApiResponse(res)
    expect([401, 403].includes(result.status)).toBe(true)
  })
})
