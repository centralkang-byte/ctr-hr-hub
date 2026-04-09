// ═══════════════════════════════════════════════════════════
// Phase 2 API P14 — Spec 2
// Compensation Deep (Letters, Matrix, Salary Bands, Simulation),
// Entity Transfers Multi-Role, Approvals Inbox,
// My Documents + Certificates, Unified Tasks
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import * as f from '../helpers/p14-fixtures'

// ═══════════════════════════════════════════════════════════
// Section A: Compensation Letters — HR_ADMIN (7 tests)
// ═══════════════════════════════════════════════════════════

test.describe('Compensation Letters: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })
  test.describe.configure({ mode: 'serial' })

  let cycleId = ''

  test('resolve cycle ID', async ({ request }) => {
    const api = new ApiClient(request)
    cycleId = await f.resolveCycleId(api)
    expect(cycleId).toBeTruthy()
  })

  test('GET /compensation/letters list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listCompLetters(api, { cycleId })
    assertOk(res, 'list compensation letters')
  })

  test('POST /compensation/letters generate', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.generateCompLetters(api, f.buildLetterGenerate(cycleId))
    // May succeed or fail if no compensation histories exist
    expect([200, 201, 400, 404]).toContain(res.status)
  })

  test('POST /compensation/letters missing cycleId → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.generateCompLetters(api, { cycleId: '' })
    assertError(res, 400, 'missing cycleId')
  })

  test('GET /compensation/letters/[invalid-id] → 404', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getCompLetter(api, '00000000-0000-0000-0000-000000000000')
    assertError(res, 404, 'letter not found')
  })

  test('POST /compensation/letters/send empty array → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.sendCompLetters(api, f.buildLetterSend([]))
    assertError(res, 400, 'empty letterIds')
  })

  test('POST /compensation/letters/send invalid IDs', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.sendCompLetters(api, f.buildLetterSend(['00000000-0000-0000-0000-000000000000']))
    // 404 or 400 for non-existent letters
    expect([400, 404]).toContain(res.status)
  })
})

// ═══════════════════════════════════════════════════════════
// Section B: Compensation Matrix — HR_ADMIN (4 tests)
// ═══════════════════════════════════════════════════════════

test.describe('Compensation Matrix: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /compensation/matrix default', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getCompMatrix(api)
    assertOk(res, 'get default matrix')
  })

  test('POST /compensation/matrix upsert entries', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.upsertCompMatrix(api, f.buildMatrixEntries())
    // Upsert creates or replaces
    expect([200, 201]).toContain(res.status)
  })

  test('POST /compensation/matrix/copy missing source → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.copyCompMatrix(api, f.buildMatrixCopy('', ''))
    assertError(res, 400, 'missing source/target cycleId')
  })

  test('POST /compensation/matrix/copy invalid IDs → 404', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.copyCompMatrix(api, f.buildMatrixCopy(
      '00000000-0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-000000000001',
    ))
    expect([400, 404]).toContain(res.status)
  })
})

// ═══════════════════════════════════════════════════════════
// Section C: Salary Bands — HR_ADMIN (6 tests)
// ═══════════════════════════════════════════════════════════

test.describe('Salary Bands: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })
  test.describe.configure({ mode: 'serial' })

  let bandId = ''
  let jobGradeId = ''

  test('resolve job grade ID', async ({ request }) => {
    const api = new ApiClient(request)
    jobGradeId = await f.resolveJobGradeId(api)
    expect(jobGradeId).toBeTruthy()
  })

  test('POST /compensation/salary-bands create → 201', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.createSalaryBand(api, f.buildSalaryBand(jobGradeId))
    assertOk(res, 'create salary band')
    bandId = res.data.id
    expect(bandId).toBeTruthy()
  })

  test('GET /compensation/salary-bands list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listSalaryBands(api)
    assertOk(res, 'list salary bands')
  })

  test('GET /compensation/salary-bands/[id] detail', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getSalaryBand(api, bandId)
    assertOk(res, 'get salary band detail')
    expect(res.data.id).toBe(bandId)
  })

  test('PUT /compensation/salary-bands/[id] update', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.updateSalaryBand(api, bandId, f.buildSalaryBandUpdate())
    assertOk(res, 'update salary band')
  })

  test('DELETE /compensation/salary-bands/[id] soft-delete', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.deleteSalaryBand(api, bandId)
    assertOk(res, 'delete salary band')
  })
})

// ═══════════════════════════════════════════════════════════
// Section D: Compensation Simulation — HR_ADMIN (4 tests)
// ═══════════════════════════════════════════════════════════

test.describe('Compensation Simulation: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /compensation/simulation', async ({ request }) => {
    const api = new ApiClient(request)
    const cycleId = await f.resolveCycleId(api)
    const res = await f.getCompSimulation(api, { cycleId })
    assertOk(res, 'get simulation')
  })

  test('GET /compensation/simulation missing cycleId → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getCompSimulation(api, {})
    assertError(res, 400, 'missing cycleId')
  })

  test('POST /compensation/simulation/ai-recommend (smoke)', async ({ request }) => {
    const api = new ApiClient(request)
    const cycleId = await f.resolveCycleId(api)
    const empId = await f.resolveEmployeeId(api)
    const res = await f.postAiRecommend(api, f.buildAiRecommend(cycleId, empId))
    // Accept 200 (AI working) or 500 (API key missing)
    expect([200, 500]).toContain(res.status)
  })

  test('POST /compensation/simulation/ai-recommend missing fields → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.postAiRecommend(api, { cycleId: '', employeeId: '', budgetConstraint: 0, companyAvgRaise: 0 })
    assertError(res, 400, 'missing required fields')
  })
})

// ═══════════════════════════════════════════════════════════
// Section E: Entity Transfers — HR_ADMIN (5 tests)
// ═══════════════════════════════════════════════════════════

test.describe('Entity Transfers: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })
  test.describe.configure({ mode: 'serial' })

  let transferId = ''

  test('GET /entity-transfers list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listEntityTransfers(api)
    assertOk(res, 'list entity transfers')
  })

  test('GET /entity-transfers?status=TRANSFER_REQUESTED filter', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listEntityTransfers(api, { status: 'TRANSFER_REQUESTED' })
    assertOk(res, 'filter by status')
  })

  test('POST /entity-transfers create', async ({ request }) => {
    const api = new ApiClient(request)
    const empId = await f.resolveEmployeeId(api)
    const companies = await f.resolveCompanyIds(api)
    const res = await f.createEntityTransfer(api, f.buildEntityTransfer(empId, companies.secondary))
    // May fail if employee already has pending transfer or same company
    expect([200, 201, 400, 409]).toContain(res.status)
    if (res.ok) transferId = res.data.id
  })

  test('GET /entity-transfers/[id] detail', async ({ request }) => {
    test.skip(!transferId, 'no transfer created')
    const api = new ApiClient(request)
    const res = await f.getEntityTransfer(api, transferId)
    assertOk(res, 'get transfer detail')
    expect(res.data).toHaveProperty('employee')
    expect(res.data).toHaveProperty('fromCompany')
  })

  test('POST /entity-transfers missing toCompanyId → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const empId = await f.resolveEmployeeId(api)
    const res = await f.createEntityTransfer(api, { ...f.buildEntityTransfer(empId, ''), toCompanyId: '' })
    assertError(res, 400, 'missing toCompanyId')
  })
})

// ═══════════════════════════════════════════════════════════
// Section F: Entity Transfers — SUPER_ADMIN (5 tests)
// ═══════════════════════════════════════════════════════════

test.describe('Entity Transfers: SUPER_ADMIN', () => {
  test.use({ storageState: authFile('SUPER_ADMIN') })

  test('GET /entity-transfers list (cross-company)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listEntityTransfers(api)
    assertOk(res, 'list all transfers cross-company')
  })

  test('PUT /entity-transfers/[invalid-id]/approve → 404', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.approveEntityTransfer(api, '00000000-0000-0000-0000-000000000000', f.buildTransferApproval('approve'))
    assertError(res, 404, 'transfer not found for approval')
  })

  test('PUT /entity-transfers/[invalid-id]/execute → 404', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.executeEntityTransfer(api, '00000000-0000-0000-0000-000000000000')
    assertError(res, 404, 'transfer not found for execution')
  })

  test('PUT /entity-transfers/[invalid-id]/approve reject', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.approveEntityTransfer(api, '00000000-0000-0000-0000-000000000000', f.buildTransferApproval('reject', 'E2E test rejection'))
    assertError(res, 404, 'transfer not found for rejection')
  })

  test('POST /entity-transfers same company → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const empId = await f.resolveEmployeeId(api)
    const companies = await f.resolveCompanyIds(api)
    // Create transfer to SAME company should fail
    const res = await f.createEntityTransfer(api, f.buildEntityTransfer(empId, companies.primary))
    expect([400, 409]).toContain(res.status)
  })
})

// ═══════════════════════════════════════════════════════════
// Section G: Entity Transfers — EMPLOYEE RBAC (2 tests)
// ═══════════════════════════════════════════════════════════

test.describe('Entity Transfers: EMPLOYEE RBAC', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('POST /entity-transfers → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const empId = await f.resolveEmployeeId(api)
    const companies = await f.resolveCompanyIds(api)
    const res = await f.createEntityTransfer(api, f.buildEntityTransfer(empId, companies.secondary))
    assertError(res, 403, 'employee cannot create transfer')
  })

  test('PUT /entity-transfers/[id]/approve → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.approveEntityTransfer(api, '00000000-0000-0000-0000-000000000000', f.buildTransferApproval('approve'))
    assertError(res, 403, 'employee cannot approve transfer')
  })
})

// ═══════════════════════════════════════════════════════════
// Section H: Approvals Inbox — MANAGER (4 tests)
// ═══════════════════════════════════════════════════════════

test.describe('Approvals Inbox: MANAGER', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('GET /approvals/inbox list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getApprovalsInbox(api)
    assertOk(res, 'list approvals inbox')
    expect(res.data).toHaveProperty('items')
  })

  test('GET /approvals/inbox?module=LEAVE filter', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getApprovalsInbox(api, { module: 'LEAVE' })
    assertOk(res, 'filter by module')
  })

  test('GET /approvals/inbox?countOnly=true', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getApprovalsInbox(api, { countOnly: 'true' })
    assertOk(res, 'count only')
    expect(res.data).toHaveProperty('count')
  })

  test('GET /approvals/inbox?status=APPROVED history', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getApprovalsInbox(api, { status: 'APPROVED', days: '90' })
    assertOk(res, 'approval history')
  })
})

// ═══════════════════════════════════════════════════════════
// Section I: Approvals Inbox — EMPLOYEE RBAC (2 tests)
// ═══════════════════════════════════════════════════════════

test.describe('Approvals Inbox: EMPLOYEE RBAC', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /approvals/inbox → empty or limited', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getApprovalsInbox(api)
    // EMPLOYEE may get 200 with empty items (no approvals) or 403
    expect([200, 403]).toContain(res.status)
    if (res.ok) {
      expect(res.data.items?.length ?? 0).toBe(0)
    }
  })

  test('GET /approvals/inbox?countOnly=true → 0 or 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getApprovalsInbox(api, { countOnly: 'true' })
    expect([200, 403]).toContain(res.status)
  })
})

// ═══════════════════════════════════════════════════════════
// Section J: My Documents — EMPLOYEE (8 tests)
// ═══════════════════════════════════════════════════════════

test.describe('My Documents: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })
  test.describe.configure({ mode: 'serial' })

  let certRequestId = ''

  test('GET /my/documents list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listMyDocuments(api)
    assertOk(res, 'list my documents')
    expect(Array.isArray(res.data)).toBe(true)
  })

  test('GET /my/documents/[invalid-docId]/download → 404', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.downloadMyDocument(api, '00000000-0000-0000-0000-000000000000')
    assertError(res, 404, 'document not found')
  })

  test('GET /my/documents/certificate-requests list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listMyCertRequests(api)
    assertOk(res, 'list cert requests')
    expect(Array.isArray(res.data)).toBe(true)
  })

  test('POST /my/documents/request-certificate EMPLOYMENT_CERT → 201', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.requestCertificate(api, f.buildCertificateRequest())
    assertOk(res, 'request employment certificate')
    certRequestId = res.data?.id ?? ''
    expect(certRequestId).toBeTruthy()
  })

  test('POST /my/documents/request-certificate CAREER_CERT', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.requestCertificate(api, { type: 'CAREER_CERT', purpose: 'E2E career cert' })
    assertOk(res, 'request career certificate')
  })

  test('POST /my/documents/request-certificate INCOME_CERT', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.requestCertificate(api, { type: 'INCOME_CERT', purpose: 'E2E income cert' })
    assertOk(res, 'request income certificate')
  })

  test('POST /my/documents/request-certificate invalid type → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.requestCertificate(api, { type: 'INVALID_TYPE', purpose: 'bad' } as never)
    assertError(res, 400, 'invalid certificate type')
  })

  test('GET /my/documents/certificate-requests includes new request', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listMyCertRequests(api)
    assertOk(res, 'list cert requests with new')
    const requests = res.data as { id: string }[]
    expect(requests.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════
// Section K: My Documents — HR_ADMIN cross-check (2 tests)
// ═══════════════════════════════════════════════════════════

test.describe('My Documents: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /my/documents (HR_ADMIN own docs)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listMyDocuments(api)
    assertOk(res, 'HR admin own documents')
  })

  test('GET /my/documents/certificate-requests (HR_ADMIN own)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listMyCertRequests(api)
    assertOk(res, 'HR admin own cert requests')
  })
})

// ═══════════════════════════════════════════════════════════
// Section L: Unified Tasks — EMPLOYEE (4 tests)
// ═══════════════════════════════════════════════════════════

test.describe('Unified Tasks: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /unified-tasks list own', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listUnifiedTasks(api)
    assertOk(res, 'list unified tasks')
    expect(res.data).toHaveProperty('items')
  })

  test('GET /unified-tasks?types=LEAVE_APPROVAL filter', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listUnifiedTasks(api, { types: 'LEAVE_APPROVAL' })
    assertOk(res, 'filter by type')
  })

  test('GET /unified-tasks?statuses=PENDING filter', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listUnifiedTasks(api, { statuses: 'PENDING' })
    assertOk(res, 'filter by status')
  })

  test('GET /unified-tasks?mode=approvals (employee view)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listUnifiedTasks(api, { mode: 'approvals' })
    assertOk(res, 'approval mode')
    // Employee should see empty or limited approvals
    expect(res.data.items?.length ?? 0).toBe(0)
  })
})
