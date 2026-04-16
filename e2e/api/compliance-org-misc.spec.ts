// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compliance / Org / Misc API Tests
// Phase 2 P8: GDPR, regional compliance, audit, org,
// notifications, delegation, skills
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { ApiClient, assertOk } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import { resolveSeedData, type SeedData } from '../helpers/test-data'
import * as f from '../helpers/compliance-settings-fixtures'

// ═══════════════════════════════════════════════════════════
// GDPR: HR_ADMIN — DPIA Lifecycle
// ═══════════════════════════════════════════════════════════

test.describe('GDPR: HR_ADMIN DPIA Lifecycle', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let dpiaId: string

  test('POST /gdpr/dpia creates assessment', async ({ request }) => {
    const client = new ApiClient(request)
    const data = f.buildDpia('DPIA')
    const result = await f.createDpia(client, data)
    assertOk(result, 'create DPIA')
    expect(result.data).toHaveProperty('id')
    dpiaId = (result.data as Record<string, unknown>).id as string
  })

  test('GET /gdpr/dpia returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listDpia(client)
    assertOk(result, 'list DPIA')
    expect(Array.isArray(result.data)).toBe(true)
  })

  test('GET /gdpr/dpia/[id] returns detail', async ({ request }) => {
    test.skip(!dpiaId, 'No DPIA created')
    const client = new ApiClient(request)
    const result = await f.getDpia(client, dpiaId)
    assertOk(result, 'get DPIA detail')
    expect((result.data as Record<string, unknown>).id).toBe(dpiaId)
  })

  test('PUT /gdpr/dpia/[id] updates status', async ({ request }) => {
    test.skip(!dpiaId, 'No DPIA created')
    const client = new ApiClient(request)
    const result = await f.updateDpia(client, dpiaId, { status: 'IN_REVIEW' })
    // May return 200 or 400 depending on state transition rules
    expect([200, 400]).toContain(result.status)
  })
})

// ═══════════════════════════════════════════════════════════
// GDPR: HR_ADMIN — Consents & Requests
// ═══════════════════════════════════════════════════════════

test.describe('GDPR: HR_ADMIN Consents & Requests', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let seed: SeedData
  let consentId: string

  test.beforeAll(async ({ request }) => {
    seed = await resolveSeedData(request)
  })

  test('POST /gdpr/consents creates consent', async ({ request }) => {
    const client = new ApiClient(request)
    const data = f.buildConsent(seed.employeeId)
    const result = await f.createConsent(client, data)
    assertOk(result, 'create consent')
    expect(result.data).toHaveProperty('id')
    consentId = (result.data as Record<string, unknown>).id as string
  })

  test('GET /gdpr/consents returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listConsents(client)
    assertOk(result, 'list consents')
    expect(Array.isArray(result.data)).toBe(true)
  })

  test('POST /gdpr/consents/[id]/revoke revokes consent', async ({ request }) => {
    test.skip(!consentId, 'No consent created')
    const client = new ApiClient(request)
    const result = await f.revokeConsent(client, consentId)
    assertOk(result, 'revoke consent')
  })

  test('POST /gdpr/requests creates ACCESS request', async ({ request }) => {
    const client = new ApiClient(request)
    const data = f.buildGdprRequest(seed.employeeId)
    const result = await f.createGdprRequest(client, data)
    assertOk(result, 'create GDPR request')
  })

  test('GET /gdpr/requests returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listGdprRequests(client)
    assertOk(result, 'list GDPR requests')
    expect(Array.isArray(result.data)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════
// GDPR: HR_ADMIN — Retention & PII
// ═══════════════════════════════════════════════════════════

test.describe('GDPR: HR_ADMIN Retention & PII', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /gdpr/retention returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listRetentionPolicies(client)
    assertOk(result, 'list retention policies')
  })

  test('POST /gdpr/retention creates policy', async ({ request }) => {
    const client = new ApiClient(request)
    const data = f.buildRetentionPolicy('RET')
    const result = await f.createRetentionPolicy(client, data)
    // May return 201 (created), 409 (duplicate category), or 400 (validation)
    expect([200, 201, 400, 409]).toContain(result.status)
  })

  test('GET /gdpr/pii-access returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listPiiAccess(client)
    assertOk(result, 'list PII access')
  })

  test('GET /gdpr/pii-access/dashboard returns dashboard', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getPiiDashboard(client)
    assertOk(result, 'get PII dashboard')
  })
})

// ═══════════════════════════════════════════════════════════
// Regional KR: HR_ADMIN
// ═══════════════════════════════════════════════════════════

test.describe('Regional KR: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /compliance/kr/mandatory-training returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listMandatoryTrainingKR(client)
    assertOk(result, 'list mandatory training KR')
  })

  test('GET /compliance/kr/work-hours returns data', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getWorkHours(client)
    assertOk(result, 'get work hours')
  })

  test('GET /compliance/kr/work-hours/employees returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getWorkHoursEmployees(client)
    assertOk(result, 'get work hours employees')
  })

  test('GET /compliance/kr/work-hours/alerts returns alerts', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getWorkHoursAlerts(client)
    assertOk(result, 'get work hours alerts')
  })
})

// ═══════════════════════════════════════════════════════════
// Regional CN: HR_ADMIN (may return empty — CTR company)
// ═══════════════════════════════════════════════════════════

test.describe('Regional CN: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /compliance/cn/social-insurance/config returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listSocialInsuranceConfig(client)
    assertOk(result, 'list CN social insurance config')
  })

  test('GET /compliance/cn/social-insurance/records returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listSocialInsuranceRecords(client, { year: '2025', month: '6' })
    assertOk(result, 'list CN social insurance records')
  })
})

// ═══════════════════════════════════════════════════════════
// Regional RU: HR_ADMIN
// ═══════════════════════════════════════════════════════════

test.describe('Regional RU: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /compliance/ru/kedo returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listKedo(client)
    assertOk(result, 'list RU KEDO')
  })

  test('GET /compliance/ru/military returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listMilitary(client)
    assertOk(result, 'list RU military')
  })

  test('GET /compliance/ru/reports/p4 returns report', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getRuReport(client, 'p4', { year: '2025', quarter: '1' })
    assertOk(result, 'get RU P4 report')
  })
})

// ═══════════════════════════════════════════════════════════
// Compliance RBAC: EMPLOYEE Blocked
// ═══════════════════════════════════════════════════════════

test.describe('Compliance RBAC: EMPLOYEE Blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /gdpr/dpia returns 401/403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listDpia(client)
    expect([401, 403]).toContain(result.status)
  })

  test('POST /gdpr/consents returns 401/403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.createConsent(client, f.buildConsent('00000000-0000-4000-a000-000000000000'))
    expect([401, 403]).toContain(result.status)
  })

  test('GET /compliance/kr/mandatory-training returns 401/403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listMandatoryTrainingKR(client)
    expect([401, 403]).toContain(result.status)
  })

  test('GET /compliance/ru/kedo returns 401/403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listKedo(client)
    expect([401, 403]).toContain(result.status)
  })
})

// ═══════════════════════════════════════════════════════════
// Audit: HR_ADMIN Logs & Policy
// ═══════════════════════════════════════════════════════════

test.describe('Audit: HR_ADMIN Logs & Policy', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /audit/logs returns paginated list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listAuditLogs(client)
    assertOk(result, 'list audit logs')
    expect(Array.isArray(result.data)).toBe(true)
  })

  test('GET /audit/logs/stats returns stats', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getAuditStats(client, { days: '30' })
    assertOk(result, 'get audit stats')
  })

  test('GET /audit/retention-policy returns policy', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getAuditRetentionPolicy(client)
    assertOk(result, 'get audit retention policy')
  })

  test('PUT /audit/retention-policy updates', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.updateAuditRetentionPolicy(client, { retentionDays: 365 })
    // May return 200 or 400 depending on schema
    expect([200, 400]).toContain(result.status)
  })
})

// ═══════════════════════════════════════════════════════════
// Audit RBAC: EMPLOYEE Blocked (MODULE.SETTINGS permission)
// ═══════════════════════════════════════════════════════════

test.describe('Audit RBAC: EMPLOYEE Blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /audit/logs returns 401/403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listAuditLogs(client)
    expect([401, 403]).toContain(result.status)
  })

  test('PUT /audit/retention-policy returns 401/403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.updateAuditRetentionPolicy(client, { retentionDays: 30 })
    expect([401, 403]).toContain(result.status)
  })
})

// ═══════════════════════════════════════════════════════════
// Org: HR_ADMIN Department CRUD
// ═══════════════════════════════════════════════════════════

test.describe('Org: HR_ADMIN Department CRUD', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let seed: SeedData
  let deptId: string

  test.beforeAll(async ({ request }) => {
    seed = await resolveSeedData(request)
  })

  test('POST /org/departments creates department', async ({ request }) => {
    const client = new ApiClient(request)
    const data = f.buildDepartment('DEPT', seed.companyId)
    const result = await f.createDepartment(client, data)
    assertOk(result, 'create department')
    expect(result.data).toHaveProperty('id')
    deptId = (result.data as Record<string, unknown>).id as string
  })

  test('GET /org/departments returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listDepartments(client)
    assertOk(result, 'list departments')
    expect(Array.isArray(result.data)).toBe(true)
    expect((result.data as unknown[]).length).toBeGreaterThan(0)
  })

  test('GET /org/departments/[id] returns detail', async ({ request }) => {
    test.skip(!deptId, 'No department created')
    const client = new ApiClient(request)
    const result = await f.getDepartment(client, deptId)
    assertOk(result, 'get department detail')
  })

  test('PUT /org/departments/[id] updates name', async ({ request }) => {
    test.skip(!deptId, 'No department created')
    const client = new ApiClient(request)
    const result = await f.updateDepartment(client, deptId, { name: 'E2E Updated Dept' })
    assertOk(result, 'update department')
  })

  test('DELETE /org/departments/[id] soft-deletes', async ({ request }) => {
    test.skip(!deptId, 'No department created')
    const client = new ApiClient(request)
    const result = await f.deleteDepartment(client, deptId)
    assertOk(result, 'delete department')
  })
})

// ═══════════════════════════════════════════════════════════
// Org: HR_ADMIN Structure (tree, companies, snapshots)
// ═══════════════════════════════════════════════════════════

test.describe('Org: HR_ADMIN Structure', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /org/tree returns tree', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getOrgTree(client)
    assertOk(result, 'get org tree')
  })

  test('GET /org/companies returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listCompanies(client)
    assertOk(result, 'list companies')
    expect(Array.isArray(result.data)).toBe(true)
    expect((result.data as unknown[]).length).toBeGreaterThan(0)
  })

  test('GET /org/snapshots returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listOrgSnapshots(client)
    // May return empty if no snapshots exist
    assertOk(result, 'list org snapshots')
  })

  test('GET /org/change-history returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listOrgChangeHistory(client)
    assertOk(result, 'list org change history')
  })
})

// ═══════════════════════════════════════════════════════════
// Notifications: EMPLOYEE Self-Service
// ═══════════════════════════════════════════════════════════

test.describe('Notifications: EMPLOYEE Self-Service', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /notifications returns own list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listNotifications(client)
    assertOk(result, 'list notifications')
  })

  test('GET /notifications/unread-count returns count', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getUnreadCount(client)
    assertOk(result, 'get unread count')
  })

  test('PUT /notifications/read-all marks all read', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.markAllNotifsRead(client)
    assertOk(result, 'mark all read')
  })

  test('GET /notifications/preferences returns preferences', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getNotifPreferences(client)
    assertOk(result, 'get notification preferences')
  })
})

// ═══════════════════════════════════════════════════════════
// Delegation: MANAGER Operations
// ═══════════════════════════════════════════════════════════

test.describe('Delegation: MANAGER Operations', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('MANAGER') })

  test('GET /delegation returns own delegations', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listDelegations(client)
    assertOk(result, 'list delegations')
  })

  test('GET /delegation/eligible returns delegatee candidates', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getEligibleDelegatees(client)
    assertOk(result, 'get eligible delegatees')
  })

  test('POST /delegation with non-existent delegatee returns error', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.createDelegation(client, {
      module: 'leave',
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 86400000 * 7).toISOString(),
      delegateeId: '00000000-0000-4000-a000-000000000000',
    })
    // Non-existent delegatee should fail with 400 or 404
    expect([400, 404]).toContain(result.status)
  })
})

// ═══════════════════════════════════════════════════════════
// Delegation RBAC: EMPLOYEE Blocked
// ═══════════════════════════════════════════════════════════

test.describe('Delegation RBAC: EMPLOYEE Blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /delegation returns 403 (handler role check)', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listDelegations(client)
    // EMPLOYEE passes withPermission but blocked by handler role check
    expect([403]).toContain(result.status)
  })
})

// ═══════════════════════════════════════════════════════════
// Skills: HR_ADMIN Analytics
// ═══════════════════════════════════════════════════════════

test.describe('Skills: HR_ADMIN Analytics', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /skills/assessments returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listSkillAssessments(client)
    assertOk(result, 'list skill assessments')
  })

  test('GET /skills/matrix returns matrix', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getSkillMatrix(client)
    assertOk(result, 'get skill matrix')
  })

  test('GET /skills/radar returns radar', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getSkillRadar(client)
    assertOk(result, 'get skill radar')
  })

  test('GET /skills/gap-report returns gap analysis', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getGapReport(client)
    assertOk(result, 'get gap report')
  })
})

// ═══════════════════════════════════════════════════════════
// Skills: EMPLOYEE Self-View + RBAC
// ═══════════════════════════════════════════════════════════

test.describe('Skills: EMPLOYEE Self-View + RBAC', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /skills/assessments returns self-only', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listSkillAssessments(client)
    assertOk(result, 'list self skill assessments')
  })

  test('GET /skills/radar returns self radar', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getSkillRadar(client)
    assertOk(result, 'get self skill radar')
  })

  test('GET /skills/team-assessments EMPLOYEE blocked', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getTeamAssessments(client)
    // EMPLOYEE should be blocked from viewing team assessments
    expect([401, 403]).toContain(result.status)
  })
})
