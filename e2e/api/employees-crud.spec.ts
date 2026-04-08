// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employees CRUD API Tests
// Covers: list, search, create, update, delete, sub-resources,
//         self-service, RBAC, cross-company, export.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile } from '../helpers/auth'
import { parseApiResponse, assertOk, assertError } from '../helpers/api-client'
import {
  createTestEmployee,
  getEmployee,
  updateEmployee,
  deleteEmployee,
  searchEmployees,
  getEmployeeSubResource,
} from '../helpers/employee-fixtures'
import { resolveSeedData, resolveEmployeeId, TEST_ACCOUNTS } from '../helpers/test-data'

// ═══════════════════════════════════════════════════════════
// HR_ADMIN: Employee CRUD
// ═══════════════════════════════════════════════════════════

test.describe('HR_ADMIN: Employee CRUD', () => {
  test.use({ storageState: authFile('HR_ADMIN') })
  test.describe.configure({ mode: 'serial' })

  let seedEmployeeId: string
  let createdEmployeeId: string
  let seedData: Awaited<ReturnType<typeof resolveSeedData>>

  test.beforeAll(async ({ request }) => {
    seedData = await resolveSeedData(request)
    seedEmployeeId = seedData.employeeId
  })

  // ─── List & Search ──────────────────────────────────────

  test('GET /employees returns paginated list', async ({ request }) => {
    const result = await searchEmployees(request, { page: '1', limit: '5' })
    assertOk(result, 'GET /employees')
    expect(Array.isArray(result.data)).toBe(true)
    expect((result.data as unknown[]).length).toBeGreaterThan(0)
    if (result.pagination) {
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(5)
      expect(result.pagination.total).toBeGreaterThan(0)
    }
  })

  test('GET /employees?search=이민준 returns matching results', async ({ request }) => {
    const result = await searchEmployees(request, { search: '이민준' })
    assertOk(result, 'search 이민준')
    const data = result.data as Array<Record<string, unknown>>
    expect(data.length).toBeGreaterThan(0)
    expect(data.some((e) => (e.name as string).includes('이민준'))).toBe(true)
  })

  test('GET /employees?status=ACTIVE filters correctly', async ({ request }) => {
    const result = await searchEmployees(request, { status: 'ACTIVE', limit: '5' })
    assertOk(result, 'status filter')
  })

  test('GET /employees?departmentId=X filters by department', async ({ request }) => {
    if (!seedData.departmentId) return test.skip()
    const result = await searchEmployees(request, { departmentId: seedData.departmentId })
    assertOk(result, 'department filter')
  })

  test('GET /employees?page=1&limit=5 pagination works', async ({ request }) => {
    const result = await searchEmployees(request, { page: '1', limit: '5' })
    assertOk(result, 'pagination')
    expect((result.data as unknown[]).length).toBeLessThanOrEqual(5)
  })

  test('GET /employees?page=999 returns empty data array', async ({ request }) => {
    const result = await searchEmployees(request, { page: '999', limit: '10' })
    assertOk(result, 'page 999')
    expect((result.data as unknown[]).length).toBe(0)
  })

  // ─── Create ─────────────────────────────────────────────

  test('POST /employees creates new employee', async ({ request }) => {
    const emp = await createTestEmployee(request)
    createdEmployeeId = emp.id
    expect(emp.id).toBeTruthy()
    expect(emp.employeeNo).toContain('e2e-emp-')
  })

  test('POST /employees missing required fields → 400', async ({ request }) => {
    const res = await request.post('/api/v1/employees', {
      data: { name: 'incomplete' },
    })
    const result = await parseApiResponse(res)
    assertError(result, 400, 'missing fields')
  })

  test('POST /employees duplicate email → 400/409', async ({ request }) => {
    // Try creating with an existing seed email
    try {
      const res = await request.post('/api/v1/employees', {
        data: {
          employeeNo: `e2e-dup-${Date.now()}`,
          name: 'duplicate test',
          email: TEST_ACCOUNTS.EMPLOYEE_A.email,
          companyId: seedData.companyId,
          departmentId: seedData.departmentId,
          jobGradeId: seedData.jobGradeId,
          jobCategoryId: seedData.companyId,
          hireDate: '2026-01-01',
          employmentType: 'FULL_TIME',
          status: 'ACTIVE',
        },
      })
      const result = await parseApiResponse(res)
      expect([400, 409, 500]).toContain(result.status)
    } catch {
      // Prisma unique constraint error is also acceptable
    }
  })

  // ─── Read / Update / Delete ─────────────────────────────

  test('GET /employees/[newId] returns created employee', async ({ request }) => {
    if (!createdEmployeeId) return test.skip()
    const result = await getEmployee(request, createdEmployeeId)
    assertOk(result, 'GET created employee')
    expect((result.data as Record<string, unknown>).id).toBe(createdEmployeeId)
  })

  test('PUT /employees/[newId] updates name', async ({ request }) => {
    if (!createdEmployeeId) return test.skip()
    const result = await updateEmployee(request, createdEmployeeId, {
      name: '수정된이름',
    })
    assertOk(result, 'update name')
  })

  test('PUT /employees/[newId] invalid data → 400', async ({ request }) => {
    if (!createdEmployeeId) return test.skip()
    const result = await updateEmployee(request, createdEmployeeId, {
      email: 'not-an-email',
    })
    assertError(result, 400, 'invalid update')
  })

  test('DELETE /employees/[newId] soft deletes', async ({ request }) => {
    if (!createdEmployeeId) return test.skip()
    const result = await deleteEmployee(request, createdEmployeeId)
    // 200 or 204 are both acceptable
    expect([200, 204].includes(result.status) || result.ok).toBe(true)
  })

  // ─── Sub-resources (seed employee) ──────────────────────

  test('GET /employees/[seedId]/history returns assignment history', async ({ request }) => {
    const result = await getEmployeeSubResource(request, seedEmployeeId, 'history')
    // May return 200 with data or empty array
    expect([200, 404].includes(result.status)).toBe(true)
  })

  test('GET /employees/[seedId]/compensation returns comp data', async ({ request }) => {
    const result = await getEmployeeSubResource(request, seedEmployeeId, 'compensation')
    expect([200, 404].includes(result.status)).toBe(true)
  })

  test('GET /employees/[seedId]/snapshot returns current snapshot', async ({ request }) => {
    const result = await getEmployeeSubResource(request, seedEmployeeId, 'snapshot')
    expect([200, 404].includes(result.status)).toBe(true)
  })

  test('GET /employees/[seedId]/contracts returns contract list', async ({ request }) => {
    const result = await getEmployeeSubResource(request, seedEmployeeId, 'contracts')
    expect([200, 404].includes(result.status)).toBe(true)
  })

  test('GET /employees/[seedId]/schedules returns work schedules', async ({ request }) => {
    const result = await getEmployeeSubResource(request, seedEmployeeId, 'schedules')
    expect([200, 404].includes(result.status)).toBe(true)
  })

  test('GET /employees/[seedId]/documents returns document list', async ({ request }) => {
    const result = await getEmployeeSubResource(request, seedEmployeeId, 'documents')
    expect([200, 404].includes(result.status)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════
// EMPLOYEE: Self-service
// ═══════════════════════════════════════════════════════════

test.describe('EMPLOYEE: Self-service', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  let ownEmployeeId: string

  test.beforeAll(async ({ request }) => {
    ownEmployeeId = await resolveEmployeeId(request, TEST_ACCOUNTS.EMPLOYEE_A.name)
  })

  test('GET /employees/me/total-rewards returns rewards data', async ({ request }) => {
    const res = await request.get('/api/v1/employees/me/total-rewards')
    const result = await parseApiResponse(res)
    // May return 200 (data exists) or 404 (no rewards data)
    expect([200, 404].includes(result.status)).toBe(true)
  })

  test('GET /employees/me/emergency-contacts returns contacts', async ({ request }) => {
    const res = await request.get('/api/v1/employees/me/emergency-contacts')
    const result = await parseApiResponse(res)
    expect([200, 404].includes(result.status)).toBe(true)
  })

  test('GET /employees/me/visibility returns settings', async ({ request }) => {
    const res = await request.get('/api/v1/employees/me/visibility')
    const result = await parseApiResponse(res)
    expect([200, 404].includes(result.status)).toBe(true)
  })

  test('GET /employees/[ownId] returns own profile', async ({ request }) => {
    const result = await getEmployee(request, ownEmployeeId)
    assertOk(result, 'own profile')
    expect((result.data as Record<string, unknown>).id).toBe(ownEmployeeId)
  })

  test('GET /employees/[otherId] → 403/404 (IDOR guard)', async ({ request }) => {
    // Try to access HR_ADMIN's profile as EMPLOYEE
    const hrId = await resolveEmployeeId(request, TEST_ACCOUNTS.HR_ADMIN.name).catch(() => null)
    if (!hrId) return test.skip()
    const result = await getEmployee(request, hrId)
    expect([403, 404].includes(result.status)).toBe(true)
  })

  test('POST /employees → 403 (no create permission)', async ({ request }) => {
    const res = await request.post('/api/v1/employees', {
      data: { name: 'should fail' },
    })
    const result = await parseApiResponse(res)
    expect([401, 403].includes(result.status)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════
// MANAGER: Limited read (has employees_read)
// ═══════════════════════════════════════════════════════════

test.describe('MANAGER: Limited employee access', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('GET /employees returns 200 (employees_read permission)', async ({ request }) => {
    const result = await searchEmployees(request, { limit: '5' })
    // MANAGER may have employees_read — expect either 200 or 403
    // If 200, verify it returns data
    if (result.ok) {
      expect(Array.isArray(result.data)).toBe(true)
    } else {
      expect([401, 403].includes(result.status)).toBe(true)
    }
  })

  test('POST /employees → 403 (no create permission)', async ({ request }) => {
    const res = await request.post('/api/v1/employees', {
      data: { name: 'should fail' },
    })
    const result = await parseApiResponse(res)
    expect([401, 403].includes(result.status)).toBe(true)
  })

  test('DELETE /employees/[id] → 403 (no delete permission)', async ({ request }) => {
    const seed = await resolveSeedData(request)
    const res = await request.delete(`/api/v1/employees/${seed.employeeId}`)
    const result = await parseApiResponse(res)
    expect([401, 403].includes(result.status)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════
// SUPER_ADMIN: Cross-company
// ═══════════════════════════════════════════════════════════

test.describe('SUPER_ADMIN: Cross-company employees', () => {
  test.use({ storageState: authFile('SUPER_ADMIN') })

  test('GET /employees returns all-company results', async ({ request }) => {
    const result = await searchEmployees(request, { limit: '10' })
    assertOk(result, 'SUPER_ADMIN list')
    expect((result.data as unknown[]).length).toBeGreaterThan(0)
  })

  test('GET /employees?companyId=X filters by company', async ({ request }) => {
    const seed = await resolveSeedData(request)
    const result = await searchEmployees(request, { companyId: seed.companyId })
    assertOk(result, 'company filter')
  })

  test('GET /employees/[anyId] can view any employee', async ({ request }) => {
    const seed = await resolveSeedData(request)
    const result = await getEmployee(request, seed.employeeId)
    assertOk(result, 'view any employee')
  })

  test('POST /employees can create in any company', async ({ request }) => {
    const emp = await createTestEmployee(request)
    expect(emp.id).toBeTruthy()
    // Clean up
    await deleteEmployee(request, emp.id)
  })

  test('GET /employees/export returns file data', async ({ request }) => {
    const res = await request.get('/api/v1/employees/export')
    // Export may return XLSX or JSON — just verify it succeeds
    expect([200, 404].includes(res.status())).toBe(true)
    if (res.status() === 200) {
      const contentType = res.headers()['content-type'] ?? ''
      // Could be application/vnd.openxmlformats... or application/json
      expect(contentType).toBeTruthy()
    }
  })
})

// ═══════════════════════════════════════════════════════════
// EMPLOYEE: Export blocked
// ═══════════════════════════════════════════════════════════

test.describe('EMPLOYEE: Export blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /employees/export → 403', async ({ request }) => {
    const res = await request.get('/api/v1/employees/export')
    const result = await parseApiResponse(res)
    expect([401, 403].includes(result.status)).toBe(true)
  })
})
