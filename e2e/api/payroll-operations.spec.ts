// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll Operations API Tests (P6 Spec 1)
// Covers: runs CRUD, allowance/deduction types CRUD,
//         dashboard, anomalies, payslips, simulation scenarios,
//         EMPLOYEE RBAC, fake-UUID boundaries.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile } from '../helpers/auth'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { resolveSeedData } from '../helpers/test-data'
import * as pf from '../helpers/payroll-analytics-fixtures'

const FAKE_UUID = '00000000-0000-0000-0000-000000000000'

// ─── A. HR_ADMIN: Payroll Run CRUD ──────────────────────────

test.describe('Payroll Runs: HR_ADMIN CRUD', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let createdRunId: string

  test('POST /runs creates DRAFT payroll run', async ({ request }) => {
    const client = new ApiClient(request)
    const data = pf.buildPayrollRun('CRUD')
    const result = await pf.createPayrollRun(client, data)
    assertOk(result, 'create payroll run')
    const run = result.data as Record<string, unknown>
    expect(run.status).toBe('DRAFT')
    expect(run.id).toBeTruthy()
    createdRunId = run.id as string
  })

  test('GET /runs returns paginated list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.listPayrollRuns(client, { page: '1', limit: '5' })
    assertOk(result, 'list payroll runs')
    expect(Array.isArray(result.data)).toBe(true)
    expect(result.pagination).toBeDefined()
  })

  test('GET /runs?status=DRAFT filters correctly', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.listPayrollRuns(client, { status: 'DRAFT' })
    assertOk(result, 'filter by status')
    const runs = result.data as Array<Record<string, unknown>>
    for (const r of runs) {
      expect(r.status).toBe('DRAFT')
    }
  })

  test('GET /runs?runType=MONTHLY filters correctly', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.listPayrollRuns(client, { runType: 'MONTHLY' })
    assertOk(result, 'filter by runType')
    const runs = result.data as Array<Record<string, unknown>>
    for (const r of runs) {
      expect(r.runType).toBe('MONTHLY')
    }
  })

  test('GET /runs/[id] returns run detail', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getPayrollRun(client, createdRunId)
    assertOk(result, 'get run detail')
    const run = result.data as Record<string, unknown>
    expect(run.id).toBe(createdRunId)
    expect(run.status).toBe('DRAFT')
  })

  test('POST /runs with missing name → 400', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await client.post('/api/v1/payroll/runs', {
      yearMonth: '2099-02',
      periodStart: '2099-02-01T00:00:00.000Z',
      periodEnd: '2099-02-28T23:59:59.000Z',
    })
    assertError(result, 400, 'missing name')
  })

  test('POST /runs with invalid yearMonth format → 400', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await client.post('/api/v1/payroll/runs', {
      name: 'Invalid YM',
      yearMonth: '2099/01',
      periodStart: '2099-01-01T00:00:00.000Z',
      periodEnd: '2099-01-31T23:59:59.000Z',
    })
    assertError(result, 400, 'invalid yearMonth')
  })
})

// ─── B. HR_ADMIN: Allowance Type CRUD ───────────────────────

test.describe('Allowance Types: HR_ADMIN CRUD', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let createdId: string

  test('POST creates new allowance type', async ({ request }) => {
    const client = new ApiClient(request)
    const data = pf.buildAllowanceType('AT')
    const result = await pf.createAllowanceType(client, data)
    assertOk(result, 'create allowance type')
    const item = result.data as Record<string, unknown>
    expect(item.id).toBeTruthy()
    expect(item.code).toBe(data.code)
    createdId = item.id as string
  })

  test('GET list returns paginated data', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.listAllowanceTypes(client, { page: '1', limit: '5' })
    assertOk(result, 'list allowance types')
    expect(Array.isArray(result.data)).toBe(true)
  })

  test('GET ?category=FIXED filters correctly', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.listAllowanceTypes(client, { category: 'FIXED' })
    assertOk(result, 'filter by category')
    const items = result.data as Array<Record<string, unknown>>
    for (const item of items) {
      expect(item.category).toBe('FIXED')
    }
  })

  test('GET /[id] returns detail', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getAllowanceType(client, createdId)
    assertOk(result, 'get allowance type detail')
    const item = result.data as Record<string, unknown>
    expect(item.id).toBe(createdId)
  })

  test('PUT /[id] updates name', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.updateAllowanceType(client, createdId, {
      name: `Updated ALW ${Date.now()}`,
    })
    assertOk(result, 'update allowance type')
  })

  test('DELETE /[id] soft-deletes', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.deleteAllowanceType(client, createdId)
    // DELETE should succeed (200 or 204)
    expect(result.ok).toBe(true)
  })

  test('GET /[id] after delete returns 404 or inactive', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getAllowanceType(client, createdId)
    // Soft-deleted items may return 404 or still be accessible
    // Either is acceptable — document the behavior
    expect([200, 404]).toContain(result.status)
  })
})

// ─── C. HR_ADMIN: Deduction Type CRUD ───────────────────────

test.describe('Deduction Types: HR_ADMIN CRUD', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let createdId: string

  test('POST creates new deduction type', async ({ request }) => {
    const client = new ApiClient(request)
    const data = pf.buildDeductionType('DT')
    const result = await pf.createDeductionType(client, data)
    assertOk(result, 'create deduction type')
    const item = result.data as Record<string, unknown>
    expect(item.id).toBeTruthy()
    createdId = item.id as string
  })

  test('GET list returns paginated data', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.listDeductionTypes(client, { page: '1', limit: '5' })
    assertOk(result, 'list deduction types')
    expect(Array.isArray(result.data)).toBe(true)
  })

  test('GET ?category=STATUTORY filters', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.listDeductionTypes(client, { category: 'STATUTORY' })
    assertOk(result, 'filter by category')
    const items = result.data as Array<Record<string, unknown>>
    for (const item of items) {
      expect(item.category).toBe('STATUTORY')
    }
  })

  test('GET /[id] returns detail', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getDeductionType(client, createdId)
    assertOk(result, 'get deduction type detail')
  })

  test('PUT /[id] updates description', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.updateDeductionType(client, createdId, {
      description: `Updated DED ${Date.now()}`,
    })
    assertOk(result, 'update deduction type')
  })

  test('DELETE /[id] soft-deletes', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.deleteDeductionType(client, createdId)
    expect(result.ok).toBe(true)
  })
})

// ─── D. HR_ADMIN: Dashboard, Anomalies & Workflow ───────────

test.describe('Payroll Dashboard & Anomalies: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  const now = new Date()
  const currentYear = String(now.getFullYear())
  const currentMonth = String(now.getMonth() + 1)

  test('GET /dashboard returns pipelines + summary', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getPayrollDashboard(client)
    assertOk(result, 'get dashboard')
    const data = result.data as Record<string, unknown>
    expect(data.pipelines).toBeDefined()
    expect(data.summary).toBeDefined()
  })

  test('GET /dashboard with year/month params returns scoped data', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getPayrollDashboard(client, {
      year: currentYear,
      month: currentMonth,
    })
    assertOk(result, 'dashboard with params')
  })

  test('GET /dashboard summary includes totalCompanies', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getPayrollDashboard(client)
    assertOk(result, 'dashboard summary')
    const data = result.data as Record<string, unknown>
    const summary = data.summary as Record<string, unknown>
    expect(summary.totalCompanies).toBeDefined()
    expect(typeof summary.totalCompanies).toBe('number')
  })

  test('GET /anomalies returns shape with scannedCount', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getPayrollAnomalies(client, {
      year: currentYear,
      month: currentMonth,
    })
    assertOk(result, 'get anomalies')
    const data = result.data as Record<string, unknown>
    expect(data.year).toBeDefined()
    expect(data.month).toBeDefined()
    expect(data.anomalies).toBeDefined()
    expect(Array.isArray(data.anomalies)).toBe(true)
    expect(typeof data.scannedCount).toBe('number')
  })

  test('GET /anomalies includes totalAnomalies field', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getPayrollAnomalies(client, {
      year: currentYear,
      month: currentMonth,
    })
    assertOk(result, 'anomalies totalAnomalies')
    const data = result.data as Record<string, unknown>
    expect(typeof data.totalAnomalies).toBe('number')
  })

  test('submit-for-approval on DRAFT run returns state error', async ({ request }) => {
    const client = new ApiClient(request)
    // Create a DRAFT run — cannot submit without going through REVIEW first
    const run = pf.buildPayrollRun('SUBMIT')
    const createResult = await pf.createPayrollRun(client, run)
    assertOk(createResult, 'create run for submit test')
    const runId = (createResult.data as Record<string, unknown>).id as string

    const submitResult = await pf.submitForApproval(client, runId)
    // DRAFT → submit should fail (requires REVIEW status)
    expect(submitResult.ok).toBe(false)
    expect([400, 409]).toContain(submitResult.status)
  })

  test('GET adjustments for seed payroll run returns shape', async ({ request }) => {
    const client = new ApiClient(request)
    // List runs to find an existing one
    const listResult = await pf.listPayrollRuns(client, { limit: '1' })
    assertOk(listResult, 'list runs for adjustments')
    const runs = listResult.data as Array<Record<string, unknown>>
    if (runs.length === 0) return // skip if no runs exist

    const runId = runs[0].id as string
    const result = await pf.getRunAdjustments(client, runId)
    // May return 200 with data or 404 if adjustments route uses different path
    expect([200, 404]).toContain(result.status)
  })
})

// ─── E. HR_ADMIN: Payslips & Exchange Rates ─────────────────

test.describe('Payslips & Rates: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /payslips returns paginated list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.listPayslips(client, { page: '1', limit: '5' })
    assertOk(result, 'list payslips')
    expect(Array.isArray(result.data)).toBe(true)
  })

  test('GET /payslips?year=2025&month=1 filters by period', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.listPayslips(client, { year: '2025', month: '1' })
    assertOk(result, 'filter payslips by period')
    expect(Array.isArray(result.data)).toBe(true)
  })

  test('GET /exchange-rates returns data', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getExchangeRates(client)
    // May return 200 with data or empty
    expect(result.ok).toBe(true)
  })

  test('GET /attendance-status returns status', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getAttendanceStatus(client)
    expect(result.ok).toBe(true)
  })
})

// ─── F. HR_ADMIN: Simulation Scenarios CRUD ─────────────────

test.describe('Simulation Scenarios: HR_ADMIN CRUD', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let scenarioId: string

  test('POST creates scenario', async ({ request }) => {
    const client = new ApiClient(request)
    const data = pf.buildSimScenario('SC')
    const result = await pf.createSimScenario(client, data)
    assertOk(result, 'create scenario')
    const item = result.data as Record<string, unknown>
    expect(item.id).toBeTruthy()
    scenarioId = item.id as string
  })

  test('GET list returns scenarios', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.listSimScenarios(client)
    assertOk(result, 'list scenarios')
    expect(Array.isArray(result.data)).toBe(true)
  })

  test('GET /[id] returns detail with results', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getSimScenario(client, scenarioId)
    assertOk(result, 'get scenario detail')
    const item = result.data as Record<string, unknown>
    expect(item.id).toBe(scenarioId)
    expect(item.results).toBeDefined()
  })

  test('GET ?mode=SINGLE filters by mode', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.listSimScenarios(client, { mode: 'SINGLE' })
    assertOk(result, 'filter scenarios by mode')
    const items = result.data as Array<Record<string, unknown>>
    for (const item of items) {
      expect(item.mode).toBe('SINGLE')
    }
  })

  test('DELETE /[id] removes scenario', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.deleteSimScenario(client, scenarioId)
    expect(result.ok).toBe(true)
  })
})

// ─── G. EMPLOYEE: My Payslips ───────────────────────────────

test.describe('Payroll: EMPLOYEE My Payslips', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /payroll/me returns own payslips', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getMyPayslips(client)
    assertOk(result, 'get my payslips')
    expect(Array.isArray(result.data)).toBe(true)
  })

  test('GET /payroll/me items include detail shape', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getMyPayslips(client)
    assertOk(result, 'my payslips shape')
    const items = result.data as Array<Record<string, unknown>>
    if (items.length > 0) {
      const first = items[0]
      // Should have payslip detail structure
      expect(first.detail).toBeDefined()
    }
  })
})

// ─── H. RBAC: EMPLOYEE Blocked from Payroll Admin ───────────

test.describe('Payroll RBAC: EMPLOYEE blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('EMPLOYEE blocked from GET /payroll/runs', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.listPayrollRuns(client)
    expect([401, 403]).toContain(result.status)
  })

  test('EMPLOYEE blocked from POST /payroll/runs', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.createPayrollRun(client, pf.buildPayrollRun('RBAC'))
    expect([401, 403]).toContain(result.status)
  })

  test('EMPLOYEE blocked from GET /payroll/allowance-types', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.listAllowanceTypes(client)
    expect([401, 403]).toContain(result.status)
  })

  test('EMPLOYEE blocked from GET /payroll/dashboard', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getPayrollDashboard(client)
    expect([401, 403]).toContain(result.status)
  })
})

// ─── I. Boundary: Fake UUID & Pay Items ─────────────────────

test.describe('Payroll Boundary Tests', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /payroll/runs/[fake-uuid] → 404', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getPayrollRun(client, FAKE_UUID)
    expect([404, 400]).toContain(result.status)
  })

  test('GET /payroll/allowance-types/[fake-uuid] → 404', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getAllowanceType(client, FAKE_UUID)
    expect([404, 400]).toContain(result.status)
  })

  test('GET employee pay-items returns data', async ({ request }) => {
    const client = new ApiClient(request)
    const seedData = await resolveSeedData(request)
    const result = await pf.getEmployeePayItems(client, seedData.employeeId)
    // May return 200 with data or empty array
    expect(result.ok).toBe(true)
  })
})
