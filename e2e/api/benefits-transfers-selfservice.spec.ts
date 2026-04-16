// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Phase 2 API P9 Spec 2
// Benefits policies/enrollments, Entity Transfers approval,
// Bulk Movements templates, Profile Change Requests,
// Positions, Process Settings, Home/Dashboard, Manager Hub,
// Search, and My Documents.
// 53 tests
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import { resolveSeedData } from '../helpers/test-data'
import * as f from '../helpers/loa-discipline-misc-fixtures'

// ═══════════════════════════════════════════════════════════
// BENEFITS POLICIES: HR_ADMIN CRUD
// ═══════════════════════════════════════════════════════════

test.describe('Benefits Policies: HR_ADMIN CRUD', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let policyId = ''

  test('POST /benefits/policies creates HEALTH policy', async ({ request }) => {
    const api = new ApiClient(request)
    const data = f.buildBenefitPolicy()
    const res = await f.createBenefitPolicy(api, data)
    assertOk(res, 'create benefit policy')
    const d = res.data as Record<string, unknown>
    expect(d).toHaveProperty('id')
    expect(d.category).toBe('HEALTH')
    policyId = d.id as string
  })

  test('GET /benefits/policies returns paginated list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listBenefitPolicies(api)
    assertOk(res, 'list policies')
    expect(res.pagination).toBeDefined()
    const items = res.data as Array<{ id: string }>
    expect(items.some((i) => i.id === policyId)).toBe(true)
  })

  test('GET /benefits/policies/[id] returns detail', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getBenefitPolicy(api, policyId)
    assertOk(res, 'get policy detail')
    expect((res.data as Record<string, unknown>).id).toBe(policyId)
  })

  test('PUT /benefits/policies/[id] updates name', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.updateBenefitPolicy(api, policyId, { name: 'E2E 수정 복리후생' })
    assertOk(res, 'update policy')
    expect((res.data as Record<string, unknown>).name).toBe('E2E 수정 복리후생')
  })

  test('GET ?category=HEALTH returns filtered', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listBenefitPolicies(api, { category: 'HEALTH' })
    assertOk(res, 'filter HEALTH')
    const items = res.data as Array<{ category: string }>
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((i) => i.category === 'HEALTH')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════
// BENEFITS ENROLLMENTS: HR_ADMIN
// ═══════════════════════════════════════════════════════════

test.describe('Benefits Enrollments: HR_ADMIN', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let policyId = ''
  let employeeId = ''

  test.beforeAll(async ({ request }) => {
    const api = new ApiClient(request)
    const seed = await resolveSeedData(request)
    employeeId = seed.employeeId

    // Create a policy to enroll into
    const pRes = await f.createBenefitPolicy(api, f.buildBenefitPolicy())
    assertOk(pRes, 'create policy for enrollment')
    policyId = (pRes.data as Record<string, unknown>).id as string
  })

  test('POST /benefits/enrollments enrolls employee', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.createBenefitEnrollment(api, { employeeId, policyId })
    assertOk(res, 'create enrollment')
    const d = res.data as Record<string, unknown>
    expect(d).toHaveProperty('id')
  })

  test('GET /benefits/enrollments returns list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listBenefitEnrollments(api)
    assertOk(res, 'list enrollments')
    const items = res.data as Array<Record<string, unknown>>
    expect(items.length).toBeGreaterThan(0)
  })

  test('GET ?employeeId=X returns filtered', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listBenefitEnrollments(api, { employeeId })
    assertOk(res, 'filter by employee')
    const items = res.data as Array<Record<string, unknown>>
    expect(items.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════
// BENEFITS RBAC: EMPLOYEE Blocked
// ═══════════════════════════════════════════════════════════

test.describe('Benefits RBAC: EMPLOYEE Blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('POST /benefits/policies → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.createBenefitPolicy(api, f.buildBenefitPolicy())
    assertError(res, 403, 'EMPLOYEE policy create')
  })

  test('POST /benefits/enrollments → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.createBenefitEnrollment(api, { employeeId: 'fake', policyId: 'fake' })
    assertError(res, 403, 'EMPLOYEE enrollment create')
  })
})

// ═══════════════════════════════════════════════════════════
// ENTITY TRANSFERS: SUPER_ADMIN Approval + Execute Guard
// ═══════════════════════════════════════════════════════════

test.describe('Entity Transfers: SUPER_ADMIN Approval Flow', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('SUPER_ADMIN') })

  let employeeId = ''
  let ctrCnId = ''
  let transferId = ''

  test.beforeAll(async ({ request }) => {
    const api = new ApiClient(request)
    const seed = await resolveSeedData(request)
    employeeId = seed.employeeId

    const companies = await f.resolveCompanyIds(api)
    ctrCnId = companies.ctrCnId
  })

  test('POST /entity-transfers creates TRANSFER_REQUESTED', async ({ request }) => {
    const api = new ApiClient(request)
    const data = f.buildEntityTransfer(employeeId, ctrCnId)
    const res = await f.createEntityTransfer(api, data)
    assertOk(res, 'create entity transfer')
    const d = res.data as Record<string, unknown>
    expect(d).toHaveProperty('id')
    expect(d.status).toBe('TRANSFER_REQUESTED')
    transferId = d.id as string
  })

  test('GET /entity-transfers includes new transfer', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listEntityTransfers(api)
    assertOk(res, 'list transfers')
    const items = res.data as Array<{ id: string }>
    expect(items.some((i) => i.id === transferId)).toBe(true)
  })

  test('GET /entity-transfers/[id] returns detail', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getEntityTransfer(api, transferId)
    assertOk(res, 'get transfer detail')
    const d = res.data as Record<string, unknown>
    expect(d.status).toBe('TRANSFER_REQUESTED')
  })

  test('PUT approve {action:approve} → FROM_APPROVED', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.approveEntityTransfer(api, transferId, { action: 'approve' })
    assertOk(res, 'approve → FROM_APPROVED')
    expect((res.data as Record<string, unknown>).status).toBe('FROM_APPROVED')
  })

  test('PUT approve {action:reject} on FROM_APPROVED → TRANSFER_CANCELLED', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.approveEntityTransfer(api, transferId, {
      action: 'reject',
      cancellationReason: 'E2E 테스트 거절',
    })
    assertOk(res, 'reject at FROM_APPROVED')
    expect((res.data as Record<string, unknown>).status).toBe('TRANSFER_CANCELLED')
  })

  test('PUT approve on CANCELLED → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.approveEntityTransfer(api, transferId, { action: 'approve' })
    assertError(res, 400, 'approve on cancelled')
  })

  test('PUT execute on CANCELLED → 400 (execute guard)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.executeEntityTransfer(api, transferId)
    assertError(res, 400, 'execute on cancelled')
  })

  test('GET ?status=TRANSFER_CANCELLED returns filtered', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listEntityTransfers(api, { status: 'TRANSFER_CANCELLED' })
    assertOk(res, 'filter cancelled')
    const items = res.data as Array<{ status: string }>
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((i) => i.status === 'TRANSFER_CANCELLED')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════
// ENTITY TRANSFERS RBAC: EMPLOYEE Blocked
// ═══════════════════════════════════════════════════════════

test.describe('Entity Transfers RBAC: EMPLOYEE Blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /entity-transfers → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listEntityTransfers(api)
    assertError(res, 403, 'EMPLOYEE transfer list')
  })

  test('POST /entity-transfers → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.createEntityTransfer(api, f.buildEntityTransfer('fake', 'fake'))
    assertError(res, 403, 'EMPLOYEE transfer create')
  })
})

// ═══════════════════════════════════════════════════════════
// BULK MOVEMENTS: Templates + Validate Error
// ═══════════════════════════════════════════════════════════

test.describe('Bulk Movements: Templates', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /templates/transfer returns 200', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await api.getRaw('/api/v1/bulk-movements/templates/transfer')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
  })

  test('GET /templates/promotion returns 200', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await api.getRaw('/api/v1/bulk-movements/templates/promotion')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
  })

  test('GET /templates/INVALID_TYPE returns error', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getBulkTemplate(api, 'INVALID_TYPE')
    expect([400, 404]).toContain(res.status)
  })

  test('POST /validate without file returns 400', async ({ request }) => {
    const api = new ApiClient(request)
    // Send empty body — should fail validation (no CSV file)
    const res = await api.post('/api/v1/bulk-movements/validate', {})
    assertError(res, 400, 'validate without file')
  })
})

// ═══════════════════════════════════════════════════════════
// BULK MOVEMENTS RBAC: EMPLOYEE Blocked
// ═══════════════════════════════════════════════════════════

test.describe('Bulk Movements RBAC: EMPLOYEE Blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /templates/transfer → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getBulkTemplate(api, 'transfer')
    assertError(res, 403, 'EMPLOYEE bulk template')
  })
})

// ═══════════════════════════════════════════════════════════
// PROFILE CHANGE REQUESTS: Self-Service (Approve Path)
// ═══════════════════════════════════════════════════════════

test.describe('Profile Change Requests: Approve Path', () => {
  test.describe.configure({ mode: 'serial' })

  let changeRequestId = ''

  test.describe('EMPLOYEE creates request', () => {
    test.use({ storageState: authFile('EMPLOYEE') })

    test('POST /profile/change-requests creates phone change', async ({ request }) => {
      const api = new ApiClient(request)
      const data = f.buildProfileChangeRequest()
      const res = await f.createProfileChangeRequest(api, data)
      assertOk(res, 'create change request')
      const d = res.data as Record<string, unknown>
      expect(d).toHaveProperty('id')
      expect(d.fieldName).toBe('phone')
      changeRequestId = d.id as string
    })

    test('GET /profile/change-requests returns own list', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await f.listProfileChangeRequests(api)
      assertOk(res, 'list own requests')
      const items = res.data as Array<{ id: string }>
      expect(items.some((i) => i.id === changeRequestId)).toBe(true)
    })
  })

  test.describe('HR_ADMIN reviews request', () => {
    test.use({ storageState: authFile('HR_ADMIN') })

    test('GET /profile/change-requests/pending returns pending list', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await f.listPendingProfileChanges(api)
      assertOk(res, 'list pending')
      const items = res.data as Array<{ id: string }>
      expect(items.length).toBeGreaterThan(0)
    })

    test('PUT [id]/review {action:APPROVE} approves', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await f.reviewProfileChange(api, changeRequestId, { action: 'APPROVE' })
      assertOk(res, 'approve change request')
    })

    test('PUT [id]/review on already approved → 400', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await f.reviewProfileChange(api, changeRequestId, { action: 'APPROVE' })
      assertError(res, 400, 'double approve')
    })
  })
})

// ═══════════════════════════════════════════════════════════
// PROFILE CHANGE REQUESTS: Rejection Path
// ═══════════════════════════════════════════════════════════

test.describe('Profile Change Requests: Reject Path', () => {
  test.describe.configure({ mode: 'serial' })

  let changeRequestId = ''

  test.describe('EMPLOYEE creates request', () => {
    test.use({ storageState: authFile('EMPLOYEE') })

    test('POST creates 2nd request for rejection', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await f.createProfileChangeRequest(api, f.buildProfileChangeRequest())
      assertOk(res, 'create for reject')
      changeRequestId = (res.data as Record<string, unknown>).id as string
    })
  })

  test.describe('HR_ADMIN rejects', () => {
    test.use({ storageState: authFile('HR_ADMIN') })

    test('PUT [id]/review {action:REJECT} rejects', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await f.reviewProfileChange(api, changeRequestId, {
        action: 'REJECT',
        rejectionReason: 'E2E 거절 사유',
      })
      assertOk(res, 'reject change request')
    })

    test('PUT [id]/review on rejected → 400', async ({ request }) => {
      const api = new ApiClient(request)
      const res = await f.reviewProfileChange(api, changeRequestId, { action: 'APPROVE' })
      assertError(res, 400, 'review on rejected')
    })
  })
})

// ═══════════════════════════════════════════════════════════
// POSITIONS: HR_ADMIN CRUD
// ═══════════════════════════════════════════════════════════

test.describe('Positions: HR_ADMIN CRUD', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let positionId = ''
  let companyId = ''

  test.beforeAll(async ({ request }) => {
    const seed = await resolveSeedData(request)
    companyId = seed.companyId
  })

  test('POST /positions creates position', async ({ request }) => {
    const api = new ApiClient(request)
    const data = f.buildPosition(companyId)
    const res = await f.createPosition(api, data)
    assertOk(res, 'create position')
    const d = res.data as Record<string, unknown>
    expect(d).toHaveProperty('id')
    positionId = d.id as string
  })

  test('GET /positions returns list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listPositions(api)
    assertOk(res, 'list positions')
    const items = res.data as Array<{ id: string }>
    expect(items.some((i) => i.id === positionId)).toBe(true)
  })

  test('GET ?companyId=X returns filtered', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listPositions(api, { companyId })
    assertOk(res, 'filter by company')
    const items = res.data as Array<Record<string, unknown>>
    expect(items.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════
// PROCESS SETTINGS: HR_ADMIN Read/Write
// ═══════════════════════════════════════════════════════════

test.describe('Process Settings: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /process-settings/PAYROLL returns settings', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getProcessSettings(api, 'PAYROLL')
    assertOk(res, 'get payroll settings')
  })

  test('GET /process-settings/LEAVE returns settings', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getProcessSettings(api, 'LEAVE')
    assertOk(res, 'get leave settings')
  })

  test('GET /process-settings/INVALID returns 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getProcessSettings(api, 'INVALID_CATEGORY')
    assertError(res, 400, 'invalid category')
  })

  test('PUT /process-settings/LEAVE upserts override', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.putProcessSettings(api, 'LEAVE', {
      key: 'e2e_test_key',
      value: { enabled: true },
    })
    assertOk(res, 'upsert leave setting')
  })
})

// ═══════════════════════════════════════════════════════════
// PROCESS SETTINGS RBAC: EMPLOYEE Blocked (PUT)
// ═══════════════════════════════════════════════════════════

test.describe('Process Settings RBAC: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('PUT /process-settings/PAYROLL → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.putProcessSettings(api, 'PAYROLL', {
      settingKey: 'test',
      value: {},
    })
    assertError(res, 403, 'EMPLOYEE process settings PUT')
  })
})

// ═══════════════════════════════════════════════════════════
// HOME/DASHBOARD: Role-based Responses
// ═══════════════════════════════════════════════════════════

test.describe('Home Summary: Role-based', () => {
  test('GET /home/summary as EMPLOYEE returns data', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile('EMPLOYEE') })
    const api = new ApiClient(ctx.request)
    const res = await f.getHomeSummary(api)
    assertOk(res, 'EMPLOYEE home summary')
    await ctx.close()
  })

  test('GET /home/summary as MANAGER returns data', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile('MANAGER') })
    const api = new ApiClient(ctx.request)
    const res = await f.getHomeSummary(api)
    assertOk(res, 'MANAGER home summary')
    await ctx.close()
  })

  test('GET /home/summary as HR_ADMIN returns data', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile('HR_ADMIN') })
    const api = new ApiClient(ctx.request)
    const res = await f.getHomeSummary(api)
    assertOk(res, 'HR_ADMIN home summary')
    await ctx.close()
  })
})

// ═══════════════════════════════════════════════════════════
// DASHBOARD: HR_ADMIN
// ═══════════════════════════════════════════════════════════

test.describe('Dashboard: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /dashboard/summary returns stats', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getDashboardSummary(api)
    assertOk(res, 'dashboard summary')
  })

  test('GET /dashboard/compare returns comparison data', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getDashboardCompare(api)
    assertOk(res, 'dashboard compare')
  })
})

// ═══════════════════════════════════════════════════════════
// MANAGER HUB: MANAGER Endpoints
// ═══════════════════════════════════════════════════════════

test.describe('Manager Hub: MANAGER', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('GET /manager-hub/summary returns data', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getManagerSummary(api)
    assertOk(res, 'manager summary')
  })

  test('GET /manager-hub/alerts returns alerts', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getManagerAlerts(api)
    assertOk(res, 'manager alerts')
  })

  test('GET /manager-hub/pending-approvals returns data', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getManagerPendingApprovals(api)
    assertOk(res, 'manager pending approvals')
  })
})

// ═══════════════════════════════════════════════════════════
// SEARCH: Command & Employees
// ═══════════════════════════════════════════════════════════

test.describe('Search', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /search/command?q=이민준 returns match', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.searchCommand(api, '이민준')
    assertOk(res, 'command search')
    // Response shape: { employees: [...], documents: [...] }
    const d = res.data as Record<string, unknown>
    const employees = (d.employees ?? []) as Array<Record<string, unknown>>
    expect(employees.length).toBeGreaterThan(0)
  })

  test('GET /search/employees?search=이민준 returns results', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.searchEmployees(api, '이민준')
    assertOk(res, 'employee search')
    const items = res.data as Array<Record<string, unknown>>
    expect(items.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════
// MY DOCUMENTS: EMPLOYEE Self-Service
// ═══════════════════════════════════════════════════════════

test.describe('My Documents: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /my/documents returns own documents', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listMyDocuments(api)
    // May return empty array if no docs — just check 200
    expect(res.ok).toBe(true)
  })

  test('GET /my/documents/certificate-requests returns own cert requests', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listCertificateRequests(api)
    // May return empty array — just check 200
    expect(res.ok).toBe(true)
  })
})
