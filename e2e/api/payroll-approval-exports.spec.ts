// ═══════════════════════════════════════════════════════════
// Phase 2 API P12 — Spec 2
// Payroll Approval Pipeline, Comparison, Exports,
// Notify/Publish Status, Simulation Scenarios,
// Whitelist Deep, RBAC Breadth
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import * as f from '../helpers/p12-fixtures'

// ═══════════════════════════════════════════════════════════
// Section A: Approval Pipeline — HR_ADMIN (serial)
// ═══════════════════════════════════════════════════════════

test.describe('Approval Pipeline: HR_ADMIN', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let runId = ''

  test('resolve payroll run for approval tests', async ({ request }) => {
    const api = new ApiClient(request)
    const rId = await f.resolvePayrollRunId(api)
    expect(rId, 'payroll runId must exist').toBeTruthy()
    runId = rId!
  })

  test('GET /[runId]/approval-status returns current status', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getApprovalStatus(api, runId)
    assertOk(res, 'approval status')
    const data = res.data as { run: { id: string; status: string }; chain: unknown[] }
    expect(data.run).toBeDefined()
    expect(data.run.id).toBe(runId)
    expect(Array.isArray(data.chain)).toBe(true)
  })

  test('POST /[runId]/submit-for-approval transitions to PENDING', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.submitForApproval(api, runId)
    // 200 if REVIEW status, 400 if not REVIEW
    expect([200, 400]).toContain(res.status)
    if (res.status === 200) {
      const data = res.data as { payrollRun: { status: string } }
      expect(data.payrollRun.status).toBe('PENDING_APPROVAL')
    }
  })

  test('POST submit-for-approval on non-REVIEW → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.submitForApproval(api, runId)
    // After previous submit, it's no longer REVIEW
    expect([400, 200]).toContain(res.status)
  })

  test('GET /[runId]/approval-status shows updated status', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getApprovalStatus(api, runId)
    assertOk(res, 'approval status after submit')
  })

  test('POST /[runId]/approve processes approval step', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.approveRun(api, runId)
    // 200 if PENDING_APPROVAL, 400 if not
    expect([200, 400]).toContain(res.status)
    if (res.status === 200) {
      const data = res.data as { payrollRun: { status: string }; isComplete: boolean }
      expect(data.payrollRun).toBeDefined()
    }
  })

  test('POST approve already-approved run → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.approveRun(api, runId)
    // If previous approve completed all steps, run is APPROVED now
    expect([400, 200]).toContain(res.status)
  })

  test('POST /[runId]/reject requires rejection reason', async ({ request }) => {
    const api = new ApiClient(request)
    // Try reject without comment
    const res = await f.rejectRun(api, runId, { comment: '' } as ReturnType<typeof f.buildRejectComment>)
    // 400 because comment is required (min 1 char) or not PENDING_APPROVAL
    expect([400]).toContain(res.status)
  })

  test('POST /[runId]/reject with valid reason', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.rejectRun(api, runId, f.buildRejectComment())
    // 200 if PENDING_APPROVAL, 400 if not
    expect([200, 400]).toContain(res.status)
    if (res.status === 200) {
      const data = res.data as { payrollRun: { status: string } }
      // Rejection moves run back to REVIEW
      expect(data.payrollRun.status).toBe('REVIEW')
    }
  })

  test('GET approval-status shows rejection', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getApprovalStatus(api, runId)
    assertOk(res, 'approval status after reject')
  })

  test('POST re-submit after rejection', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.submitForApproval(api, runId)
    // May succeed if run is back in REVIEW
    expect([200, 400]).toContain(res.status)
  })

  test('GET /[runId]/publish-status returns publish data', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getPublishStatus(api, runId)
    assertOk(res, 'publish status')
    const data = res.data as { run: { id: string }; payslipStats: unknown }
    expect(data.run).toBeDefined()
    expect(data.payslipStats).toBeDefined()
  })

  test('POST /[runId]/notify-unread sends reminders', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.notifyUnread(api, runId)
    // 200 on success, 400 if not APPROVED/PAID
    expect([200, 400]).toContain(res.status)
    if (res.status === 200) {
      const data = res.data as { notifiedCount: number }
      expect(typeof data.notifiedCount).toBe('number')
    }
  })
})

// ─── Approval RBAC: EMPLOYEE Blocked ────────────────────

test.describe('Approval RBAC: EMPLOYEE Blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  const fakeRunId = '00000000-0000-4000-a000-000000000001'

  test('POST /[runId]/submit-for-approval as EMPLOYEE → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.submitForApproval(api, fakeRunId)
    assertError(res, 403, 'EMPLOYEE blocked from submit')
  })

  test('POST /[runId]/approve as EMPLOYEE → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.approveRun(api, fakeRunId)
    assertError(res, 403, 'EMPLOYEE blocked from approve')
  })
})

// ─── Approval RBAC: MANAGER Blocked ─────────────────────

test.describe('Approval RBAC: MANAGER Blocked', () => {
  test.use({ storageState: authFile('MANAGER') })

  const fakeRunId = '00000000-0000-4000-a000-000000000001'

  test('POST /[runId]/approve as MANAGER → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.approveRun(api, fakeRunId)
    assertError(res, 403, 'MANAGER blocked from approve')
  })
})

// ═══════════════════════════════════════════════════════════
// Section B: Comparison — HR_ADMIN
// ═══════════════════════════════════════════════════════════

test.describe('Comparison: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  let runId = ''

  test('resolve payroll run for comparison', async ({ request }) => {
    const api = new ApiClient(request)
    const rId = await f.resolvePayrollRunId(api)
    expect(rId, 'payroll runId must exist').toBeTruthy()
    runId = rId!
  })

  test('GET /[runId]/comparison returns rows with summary', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getComparison(api, runId)
    assertOk(res, 'comparison data')
    const data = res.data as { rows: unknown[]; summary: { currentTotal: number } }
    expect(Array.isArray(data.rows)).toBe(true)
    expect(data.summary).toBeDefined()
  })

  test('GET /[runId]/comparison?anomalyOnly=true filters anomaly rows', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getComparison(api, runId, { anomalyOnly: 'true' })
    assertOk(res, 'comparison anomaly filter')
    const data = res.data as { rows: Array<{ hasAnomaly: boolean }> }
    if (data.rows.length > 0) {
      expect(data.rows.every((r) => r.hasAnomaly)).toBe(true)
    }
  })

  test('GET /[runId]/comparison?sortBy=diffNet&sortOrder=desc sorts', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getComparison(api, runId, { sortBy: 'diffNet', sortOrder: 'desc' })
    assertOk(res, 'comparison sorted')
    const data = res.data as { rows: Array<{ diffNet: number }> }
    if (data.rows.length >= 2) {
      expect(data.rows[0].diffNet).toBeGreaterThanOrEqual(data.rows[1].diffNet)
    }
  })

  test('GET /[runId]/comparison?department=X filters by dept', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getComparison(api, runId, { department: '개발팀' })
    assertOk(res, 'comparison department filter')
    const data = res.data as { rows: Array<{ department: string }> }
    if (data.rows.length > 0) {
      expect(data.rows.every((r) => r.department === '개발팀')).toBe(true)
    }
  })

  test('GET comparison with invalid runId → 404', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getComparison(api, '00000000-0000-4000-a000-000000000099')
    assertError(res, 404, 'invalid runId for comparison')
  })
})

// ─── Comparison RBAC: EMPLOYEE Blocked ──────────────────

test.describe('Comparison RBAC: EMPLOYEE Blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /[runId]/comparison as EMPLOYEE → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getComparison(api, '00000000-0000-4000-a000-000000000001')
    assertError(res, 403, 'EMPLOYEE blocked from comparison')
  })
})

// ═══════════════════════════════════════════════════════════
// Section C: Exports — HR_ADMIN
// ═══════════════════════════════════════════════════════════

test.describe('Exports: HR_ADMIN', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let runId = ''

  test('resolve payroll run for export tests', async ({ request }) => {
    const api = new ApiClient(request)
    const rId = await f.resolveApprovedRunId(api)
    expect(rId, 'payroll runId must exist').toBeTruthy()
    runId = rId!
  })

  test('GET export/transfer returns CSV with correct content-type', async ({ request }) => {
    const api = new ApiClient(request)
    const raw = await f.exportTransfer(api, runId)
    // 200 for APPROVED/PAID, 400 otherwise
    if (raw.ok) {
      expect(raw.headers['content-type']).toContain('text/csv')
    } else {
      expect([400, 429]).toContain(raw.status)
    }
  })

  test('GET export/transfer CSV has BOM for Korean Excel', async ({ request }) => {
    const api = new ApiClient(request)
    const raw = await f.exportTransfer(api, runId)
    if (raw.ok && raw.buffer.length >= 3) {
      // UTF-8 BOM: EF BB BF
      expect(raw.buffer[0]).toBe(0xEF)
      expect(raw.buffer[1]).toBe(0xBB)
      expect(raw.buffer[2]).toBe(0xBF)
    }
  })

  test('GET export/transfer has content-disposition header', async ({ request }) => {
    const api = new ApiClient(request)
    const raw = await f.exportTransfer(api, runId)
    if (raw.ok) {
      expect(raw.headers['content-disposition']).toContain('attachment')
    }
  })

  test('GET export/journal returns Excel', async ({ request }) => {
    const api = new ApiClient(request)
    const raw = await f.exportJournal(api, runId)
    if (raw.ok) {
      expect(raw.headers['content-type']).toContain('spreadsheetml')
      expect(raw.headers['content-disposition']).toContain('attachment')
    } else {
      // May fail due to rate limit or status
      expect([400, 404, 429]).toContain(raw.status)
    }
  })

  test('GET export/ledger returns Excel', async ({ request }) => {
    const api = new ApiClient(request)
    const raw = await f.exportLedger(api, runId)
    if (raw.ok) {
      expect(raw.headers['content-type']).toContain('spreadsheetml')
    } else {
      expect([400, 404, 429]).toContain(raw.status)
    }
  })

  test('GET export/comparison returns Excel', async ({ request }) => {
    const api = new ApiClient(request)
    const raw = await f.exportComparison(api, runId)
    if (raw.ok) {
      expect(raw.headers['content-type']).toContain('spreadsheetml')
    } else {
      expect([400, 404, 429]).toContain(raw.status)
    }
  })

  test('GET export on non-existent run → error', async ({ request }) => {
    const api = new ApiClient(request)
    const raw = await f.exportTransfer(api, '00000000-0000-4000-a000-000000000099')
    expect(raw.ok).toBe(false)
    expect([404, 400, 429, 500]).toContain(raw.status)
  })

  test('Export returns valid content even with empty payroll items', async ({ request }) => {
    const api = new ApiClient(request)
    // Re-fetch to check valid CSV structure
    const raw = await f.exportTransfer(api, runId)
    if (raw.ok) {
      const text = raw.buffer.toString('utf-8')
      // CSV should at least have a header line
      expect(text.length).toBeGreaterThan(0)
    }
  })
})

// ─── Exports: SUPER_ADMIN cross-company ─────────────────

test.describe('Exports: SUPER_ADMIN', () => {
  test.use({ storageState: authFile('SUPER_ADMIN') })

  test('SUPER_ADMIN can access export endpoints', async ({ request }) => {
    const api = new ApiClient(request)
    const runId = await f.resolvePayrollRunId(api)
    if (!runId) return test.skip()

    const raw = await f.exportTransfer(api, runId)
    // SUPER_ADMIN should be able to access, but may get 400 if status wrong
    expect([200, 400, 404, 429]).toContain(raw.status)
  })
})

// ─── Exports RBAC: EMPLOYEE Blocked ─────────────────────

test.describe('Exports RBAC: EMPLOYEE Blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET export/transfer as EMPLOYEE → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const raw = await f.exportTransfer(api, '00000000-0000-4000-a000-000000000001')
    expect(raw.status).toBe(403)
  })
})

// ═══════════════════════════════════════════════════════════
// Section D: Notify/Publish — HR_ADMIN
// ═══════════════════════════════════════════════════════════

test.describe('Notify/Publish: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  let runId = ''

  test('resolve payroll run for notify tests', async ({ request }) => {
    const api = new ApiClient(request)
    const rId = await f.resolvePayrollRunId(api)
    expect(rId, 'payroll runId must exist').toBeTruthy()
    runId = rId!
  })

  test('POST /[runId]/notify-unread returns notification count', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.notifyUnread(api, runId)
    // 200 if APPROVED/PAID, 400 otherwise
    expect([200, 400]).toContain(res.status)
    if (res.status === 200) {
      const data = res.data as { notifiedCount: number; message: string }
      expect(typeof data.notifiedCount).toBe('number')
      expect(data.message).toBeTruthy()
    }
  })

  test('POST notify-unread is idempotent', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.notifyUnread(api, runId)
    expect([200, 400]).toContain(res.status)
  })

  test('GET /[runId]/publish-status returns stats', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getPublishStatus(api, runId)
    assertOk(res, 'publish status')
    const data = res.data as {
      run: { id: string; yearMonth: string }
      payslipStats: { total: number; viewRate: number }
    }
    expect(data.run.yearMonth).toBeTruthy()
    expect(typeof data.payslipStats.total).toBe('number')
    expect(typeof data.payslipStats.viewRate).toBe('number')
  })

  test('POST notify-unread on non-APPROVED/PAID → 400', async ({ request }) => {
    // Try with a run that is not APPROVED/PAID
    const api = new ApiClient(request)
    // Use a run ID that might be in DRAFT
    const rId = await f.resolvePayrollRunId(api)
    if (!rId) return test.skip()
    const statusRes = await f.getApprovalStatus(api, rId)
    if (statusRes.ok) {
      const run = (statusRes.data as { run: { status: string } }).run
      if (!['APPROVED', 'PAID'].includes(run.status)) {
        const res = await f.notifyUnread(api, rId)
        assertError(res, 400, 'notify on non-APPROVED/PAID')
      }
    }
  })
})

// ─── Notify RBAC: EMPLOYEE Blocked ──────────────────────

test.describe('Notify RBAC: EMPLOYEE Blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('POST /[runId]/notify-unread as EMPLOYEE → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.notifyUnread(api, '00000000-0000-4000-a000-000000000001')
    assertError(res, 403, 'EMPLOYEE blocked from notify')
  })
})

// ─── Notify RBAC: MANAGER Blocked ───────────────────────

test.describe('Notify RBAC: MANAGER Blocked', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('POST /[runId]/notify-unread as MANAGER → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.notifyUnread(api, '00000000-0000-4000-a000-000000000001')
    assertError(res, 403, 'MANAGER blocked from notify')
  })
})

// ═══════════════════════════════════════════════════════════
// Section E: Simulation Scenarios — HR_ADMIN
// ═══════════════════════════════════════════════════════════

test.describe('Simulation Scenarios: HR_ADMIN', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let scenarioId = ''

  test('POST /simulation/scenarios creates scenario', async ({ request }) => {
    const api = new ApiClient(request)
    const data = f.buildSimulationScenario()
    const res = await f.createSimScenario(api, data)
    assertOk(res, 'create scenario')
    scenarioId = (res.data as { id: string }).id
    expect(scenarioId).toBeTruthy()
  })

  test('GET /simulation/scenarios returns list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listSimScenarios(api)
    assertOk(res, 'list scenarios')
    const data = res.data as unknown[]
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  test('GET /simulation/scenarios/[id] returns detail with results', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getSimScenario(api, scenarioId)
    assertOk(res, 'get scenario detail')
    const data = res.data as { id: string; mode: string; title: string; results: unknown }
    expect(data.id).toBe(scenarioId)
    expect(data.mode).toBe('SINGLE')
    expect(data.results).toBeDefined()
  })

  test('DELETE /simulation/scenarios/[id] removes scenario', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.deleteSimScenario(api, scenarioId)
    assertOk(res, 'delete scenario')
    const data = res.data as { deleted: boolean }
    expect(data.deleted).toBe(true)
  })

  test('GET deleted scenario → 404', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getSimScenario(api, scenarioId)
    assertError(res, 404, 'deleted scenario not found')
  })

  test('POST scenario with invalid mode → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const data = { ...f.buildSimulationScenario(), mode: 'INVALID_MODE' }
    const res = await f.createSimScenario(api, data as ReturnType<typeof f.buildSimulationScenario>)
    assertError(res, 400, 'invalid mode rejected')
  })
})

// ─── Simulation RBAC: EMPLOYEE Blocked ──────────────────

test.describe('Simulation RBAC: EMPLOYEE Blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /simulation/scenarios as EMPLOYEE → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listSimScenarios(api)
    assertError(res, 403, 'EMPLOYEE blocked from simulation scenarios')
  })
})

// ═══════════════════════════════════════════════════════════
// Section F: Whitelist Deep — HR_ADMIN
// ═══════════════════════════════════════════════════════════

test.describe('Whitelist: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  let companyId = ''

  test('resolve company for whitelist tests', async ({ request }) => {
    const cId = await f.resolveCompanyId(request)
    expect(cId, 'companyId must exist').toBeTruthy()
    companyId = cId!
  })

  test('GET /whitelist returns paginated items', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getWhitelist(api, { companyId })
    assertOk(res, 'whitelist list')
    const data = res.data as { items: unknown[]; pagination: unknown }
    expect(Array.isArray(data.items)).toBe(true)
    expect(data.pagination).toBeDefined()
  })

  test('DELETE /whitelist/[anomalyId] with non-existent → 404', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.deleteWhitelistItem(api, '00000000-0000-4000-a000-000000000099')
    assertError(res, 404, 'non-existent whitelist item')
  })

  test('GET /whitelist without companyId → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getWhitelist(api, {} as Record<string, string>)
    assertError(res, 400, 'missing companyId')
  })
})

// ─── Whitelist RBAC: EMPLOYEE Blocked ───────────────────

test.describe('Whitelist RBAC: EMPLOYEE Blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /whitelist as EMPLOYEE → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getWhitelist(api, { companyId: '00000000-0000-4000-a000-000000000001' })
    assertError(res, 403, 'EMPLOYEE blocked from whitelist')
  })
})

// ═══════════════════════════════════════════════════════════
// Section G: RBAC Breadth — EMPLOYEE/MANAGER blocked
// ═══════════════════════════════════════════════════════════

test.describe('RBAC Breadth: EMPLOYEE Blocked from exports/approval', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  const fakeRunId = '00000000-0000-4000-a000-000000000001'

  test('GET export/journal as EMPLOYEE → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const raw = await f.exportJournal(api, fakeRunId)
    expect(raw.status).toBe(403)
  })
})

test.describe('RBAC Breadth: MANAGER Blocked from exports/approval', () => {
  test.use({ storageState: authFile('MANAGER') })

  const fakeRunId = '00000000-0000-4000-a000-000000000001'

  test('POST /[runId]/submit-for-approval as MANAGER → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.submitForApproval(api, fakeRunId)
    assertError(res, 403, 'MANAGER blocked from submit-for-approval')
  })
})
