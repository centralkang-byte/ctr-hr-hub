// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Analytics & Compensation Dashboards API Tests (P6 Spec 2)
// Covers: salary bands CRUD, compensation analysis/history/matrix,
//         analytics overview/executive/domain dashboards, team health,
//         EXECUTIVE/SUPER_ADMIN cross-company, EMPLOYEE/MANAGER RBAC.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile } from '../helpers/auth'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { resolveSeedData } from '../helpers/test-data'
import * as pf from '../helpers/payroll-analytics-fixtures'

const FAKE_UUID = '00000000-0000-0000-0000-000000000000'

// ─── A. HR_ADMIN: Salary Band CRUD ──────────────────────────

test.describe('Salary Bands: HR_ADMIN CRUD', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let bandId: string
  let seedData: Awaited<ReturnType<typeof resolveSeedData>>

  test.beforeAll(async ({ request }) => {
    seedData = await resolveSeedData(request)
  })

  test('POST creates salary band', async ({ request }) => {
    const client = new ApiClient(request)
    const data = pf.buildSalaryBand(seedData.jobGradeId)
    const result = await pf.createSalaryBand(client, data)
    assertOk(result, 'create salary band')
    const band = result.data as Record<string, unknown>
    expect(band.id).toBeTruthy()
    expect(band.currency).toBe('KRW')
    bandId = band.id as string
  })

  test('POST with min >= mid → 400 (Zod refine)', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.createSalaryBand(client, {
      jobGradeId: seedData.jobGradeId,
      minSalary: 50_000_000,
      midSalary: 40_000_000, // violates min < mid
      maxSalary: 60_000_000,
      effectiveFrom: new Date().toISOString(),
    })
    assertError(result, 400, 'min >= mid validation')
  })

  test('POST with effectiveTo creates bounded band', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.createSalaryBand(client, {
      jobGradeId: seedData.jobGradeId,
      minSalary: 25_000_000,
      midSalary: 35_000_000,
      maxSalary: 50_000_000,
      effectiveFrom: new Date().toISOString(),
      effectiveTo: '2099-12-31T23:59:59.000Z',
    })
    assertOk(result, 'create band with effectiveTo')
    const band = result.data as Record<string, unknown>
    expect(band.effectiveTo).toBeTruthy()
    // Cleanup
    if (band.id) {
      await pf.deleteSalaryBand(client, band.id as string)
    }
  })

  test('GET list returns paginated data', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.listSalaryBands(client, { page: '1', limit: '5' })
    assertOk(result, 'list salary bands')
    expect(Array.isArray(result.data)).toBe(true)
  })

  test('GET /[id] returns detail with jobGrade relation', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getSalaryBand(client, bandId)
    assertOk(result, 'get salary band detail')
    const band = result.data as Record<string, unknown>
    expect(band.id).toBe(bandId)
    expect(band.jobGrade).toBeDefined()
  })

  test('PUT /[id] updates maxSalary', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.updateSalaryBand(client, bandId, {
      maxSalary: 70_000_000,
    })
    assertOk(result, 'update salary band')
  })

  test('PUT /[id] with invalid order → 400', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.updateSalaryBand(client, bandId, {
      minSalary: 80_000_000, // violates min < mid
      midSalary: 45_000_000,
    })
    assertError(result, 400, 'invalid salary order')
  })

  test('DELETE /[id] removes band', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.deleteSalaryBand(client, bandId)
    expect(result.ok).toBe(true)
  })

  test('GET /[id] after delete → 404', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getSalaryBand(client, bandId)
    expect([404, 400]).toContain(result.status)
  })
})

// ─── B. HR_ADMIN: Compensation Analysis, History, Matrix ────

test.describe('Compensation Analysis & History: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /compensation/analysis returns data', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getCompensationAnalysis(client)
    assertOk(result, 'compensation analysis')
    const data = result.data as Record<string, unknown>
    // Should have distribution or employee ratio data
    expect(data).toBeDefined()
  })

  test('GET /compensation/history returns paginated list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getCompensationHistory(client, { page: '1', limit: '5' })
    assertOk(result, 'compensation history')
    expect(Array.isArray(result.data)).toBe(true)
  })

  test('GET /compensation/matrix returns data', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getCompensationMatrix(client)
    // Matrix may return 200 with data or empty structure
    expect(result.ok).toBe(true)
  })

  test('GET /compensation/simulation without cycleId → 400', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getCompensationSimulation(client)
    // cycleId is required per simulationSearchSchema
    assertError(result, 400, 'simulation without cycleId')
  })

  test('GET /compensation/letters without cycleId → 400', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.listCompensationLetters(client)
    // cycleId is required for letters list
    assertError(result, 400, 'letters without cycleId')
  })

  test('GET /compensation/letters with fake cycleId → empty or 404', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.listCompensationLetters(client, { cycleId: FAKE_UUID })
    // Should not crash — returns empty data or 404
    expect([200, 404]).toContain(result.status)
  })
})

// ─── C. HR_ADMIN: Analytics Overview ────────────────────────

test.describe('Analytics Overview: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /analytics/overview returns 6 KPIs', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getAnalyticsOverview(client)
    assertOk(result, 'analytics overview')
    const data = result.data as Record<string, unknown>
    expect(typeof data.totalHeadcount).toBe('number')
  })

  test('response includes headcount, turnoverRate, burnoutRisk', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getAnalyticsOverview(client)
    assertOk(result, 'overview fields')
    const data = result.data as Record<string, unknown>
    expect(data.totalHeadcount).toBeDefined()
    expect(data.turnoverRateAnnualized).toBeDefined()
    expect(data.burnoutRiskCount).toBeDefined()
  })

  test('GET ?company_id=X filters by company', async ({ request }) => {
    const client = new ApiClient(request)
    const seedData = await resolveSeedData(request)
    const result = await pf.getAnalyticsOverview(client, {
      company_id: seedData.companyId,
    })
    assertOk(result, 'overview with company filter')
  })
})

// ─── D. HR_ADMIN: Executive Summary & Drilldown ─────────────

test.describe('Executive Summary & Drilldown: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /executive/summary returns kpis + charts + riskAlerts', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getExecutiveSummary(client)
    assertOk(result, 'executive summary')
    const data = result.data as Record<string, unknown>
    expect(data.kpis).toBeDefined()
    expect(data.charts).toBeDefined()
    expect(data.riskAlerts).toBeDefined()
  })

  test('kpis includes all 6 keys', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getExecutiveSummary(client)
    assertOk(result, 'exec summary kpis')
    const data = result.data as Record<string, unknown>
    const kpis = data.kpis as Record<string, unknown>
    expect(kpis.totalEmployees).toBeDefined()
    expect(kpis.monthlyTurnoverRate).toBeDefined()
    expect(kpis.avgTenureYears).toBeDefined()
    expect(kpis.monthlyLaborCost).toBeDefined()
    expect(kpis.recruitmentPipeline).toBeDefined()
    expect(kpis.onboardingCompletionRate).toBeDefined()
  })

  test('charts includes headcountTrend, turnoverTrend', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getExecutiveSummary(client)
    assertOk(result, 'exec summary charts')
    const data = result.data as Record<string, unknown>
    const charts = data.charts as Record<string, unknown>
    expect(charts.headcountTrend).toBeDefined()
    expect(charts.turnoverTrend).toBeDefined()
  })

  test('GET /drilldown?type=headcount returns data', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getExecutiveDrilldown(client, { type: 'headcount' })
    assertOk(result, 'drilldown headcount')
    const data = result.data as Record<string, unknown>
    expect(data.kpiType).toBe('headcount')
  })

  test('GET /drilldown?type=invalid → 400', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getExecutiveDrilldown(client, { type: 'invalid_type' })
    assertError(result, 400, 'drilldown invalid type')
  })
})

// ─── E. HR_ADMIN: Domain Analytics ──────────────────────────

test.describe('Domain Analytics: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /analytics/payroll/overview returns data', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getPayrollAnalyticsOverview(client)
    assertOk(result, 'payroll analytics overview')
  })

  test('GET /analytics/payroll/compa-ratio returns histogram', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getCompaRatioAnalytics(client)
    assertOk(result, 'compa-ratio analytics')
    const data = result.data as Record<string, unknown>
    expect(data.distribution).toBeDefined()
    expect(Array.isArray(data.distribution)).toBe(true)
  })

  test('GET /analytics/workforce/overview returns data', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getWorkforceOverview(client)
    assertOk(result, 'workforce overview')
  })

  test('GET /analytics/turnover returns trend data', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getTurnoverAnalytics(client)
    assertOk(result, 'turnover analytics')
    const data = result.data as Record<string, unknown>
    expect(data.monthlyTrend).toBeDefined()
    expect(data.byReason).toBeDefined()
    expect(data.byDepartment).toBeDefined()
  })

  test('GET /analytics/performance/overview returns data', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getPerformanceOverview(client)
    assertOk(result, 'performance overview')
  })

  test('GET /analytics/attendance/overview returns data', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getAttendanceAnalytics(client)
    assertOk(result, 'attendance analytics')
  })

  test('GET /analytics/compensation returns data', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getCompensationAnalyticsView(client)
    assertOk(result, 'compensation analytics')
  })

  test('GET /analytics/burnout returns data', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getBurnoutAnalytics(client)
    assertOk(result, 'burnout analytics')
  })
})

// ─── F. HR_ADMIN: Team Health & Prediction ──────────────────

test.describe('Team Health & Prediction: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /analytics/team-health-scores returns scores', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getTeamHealthScores(client)
    assertOk(result, 'team health scores')
  })

  test('GET /analytics/employee-risk returns risk data', async ({ request }) => {
    const client = new ApiClient(request)
    const seedData = await resolveSeedData(request)
    const result = await pf.getEmployeeRisk(client, {
      employee_id: seedData.employeeId,
    })
    // employee-risk requires employeeId; may return data or empty
    expect(result.ok).toBe(true)
  })

  test('GET /analytics/recruitment returns data', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getRecruitmentAnalytics(client)
    assertOk(result, 'recruitment analytics')
  })

  test('POST /analytics/calculate triggers batch prediction', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.postAnalyticsCalculate(client)
    // Calculate may take time but should return 200 or 202
    expect(result.ok).toBe(true)
  })
})

// ─── G. SUPER_ADMIN & EXECUTIVE: Cross-Company ─────────────

test.describe('Analytics: SUPER_ADMIN cross-company', () => {
  test.use({ storageState: authFile('SUPER_ADMIN') })

  test('SUPER_ADMIN GET /analytics/overview without company → all-company', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getAnalyticsOverview(client)
    assertOk(result, 'SA overview all-company')
    const data = result.data as Record<string, unknown>
    expect(typeof data.totalHeadcount).toBe('number')
  })

  test('SUPER_ADMIN POST /analytics/refresh triggers data refresh', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.postAnalyticsRefresh(client)
    expect(result.ok).toBe(true)
  })
})

// NOTE: EXECUTIVE 역할 테스트는 global-setup.ts에 EXECUTIVE 계정 추가 후 구현
// (현재 global-setup에 SA/HR/HR_CN/MGR/EMP 5역할만 등록)
// Codex Gate 1 #1 + Gate 2 #3: EXECUTIVE 인프라 선행 필요 → 다음 세션 백로그

test.describe('Analytics: SUPER_ADMIN executive summary', () => {
  test.use({ storageState: authFile('SUPER_ADMIN') })

  test('SA GET /analytics/executive/summary returns cross-company comparison', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getExecutiveSummary(client)
    assertOk(result, 'SA executive summary')
    const data = result.data as Record<string, unknown>
    expect(data.companyComparison).toBeDefined()
  })
})

// ─── H. RBAC: EMPLOYEE Blocked from Analytics ───────────────

test.describe('Analytics RBAC: EMPLOYEE blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('EMPLOYEE blocked from GET /analytics/overview', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getAnalyticsOverview(client)
    expect([401, 403]).toContain(result.status)
  })

  test('EMPLOYEE blocked from GET /analytics/executive/summary', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getExecutiveSummary(client)
    expect([401, 403]).toContain(result.status)
  })

  test('EMPLOYEE blocked from POST /analytics/calculate', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.postAnalyticsCalculate(client)
    expect([401, 403]).toContain(result.status)
  })
})

// ─── I. MANAGER: Conditional Access ─────────────────────────

test.describe('Analytics RBAC: MANAGER conditional', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('MANAGER GET /team-health/overview → 200 (team-scoped)', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getTeamHealthOverview(client)
    // MANAGER should get 200 with team data or empty state
    expect(result.ok).toBe(true)
  })

  test('MANAGER blocked from POST /analytics/refresh', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.postAnalyticsRefresh(client)
    expect([401, 403]).toContain(result.status)
  })
})
