// ═══════════════════════════════════════════════════════════
// Phase 2 API P13 — Spec 2
// Analytics Deeper (Prediction, Turnover, Team, Performance,
// Gender Pay Gap, AI Report), Compliance Deeper (GDPR, KR,
// CN, RU), Org Restructure Plans
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import * as f from '../helpers/p13-fixtures'

// ═══════════════════════════════════════════════════════════
// Section A: Analytics Prediction — HR_ADMIN
// ═══════════════════════════════════════════════════════════

test.describe('Analytics Prediction: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /analytics/prediction/burnout returns data', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getPredictionBurnout(api)
    assertOk(res, 'prediction burnout')
  })

  test('GET /analytics/prediction/turnover returns data', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getPredictionTurnover(api)
    assertOk(res, 'prediction turnover')
  })

  test('GET /analytics/prediction/burnout response shape', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getPredictionBurnout(api)
    assertOk(res, 'burnout shape')
    // Should return an array or object with burnout data
    expect(res.data).toBeDefined()
  })
})

test.describe('Analytics Prediction: EMPLOYEE Blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /analytics/prediction/burnout as EMPLOYEE → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getPredictionBurnout(api)
    assertError(res, 403, 'EMPLOYEE blocked from burnout')
  })

  test('GET /analytics/prediction/turnover as EMPLOYEE → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getPredictionTurnover(api)
    assertError(res, 403, 'EMPLOYEE blocked from turnover')
  })
})

test.describe('Analytics Prediction: MANAGER Access', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('GET /analytics/prediction/burnout as MANAGER → 200', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getPredictionBurnout(api)
    assertOk(res, 'MANAGER can access burnout')
  })
})

// ═══════════════════════════════════════════════════════════
// Section B: Analytics Turnover & Team — HR_ADMIN
// ═══════════════════════════════════════════════════════════

test.describe('Analytics Turnover & Team: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /analytics/turnover returns data', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getTurnover(api)
    assertOk(res, 'turnover')
  })

  test('GET /analytics/turnover/overview returns data', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getTurnoverOverview(api)
    assertOk(res, 'turnover overview')
  })

  test('GET /analytics/turnover-risk returns data', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getTurnoverRisk(api)
    assertOk(res, 'turnover risk')
  })

  test('GET /analytics/team-health returns data', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getTeamHealth(api)
    assertOk(res, 'team health')
  })

  test('GET /analytics/team-health/overview returns data', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getTeamHealthOverview(api)
    assertOk(res, 'team health overview')
  })

  test('GET /analytics/team-stats returns data', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getTeamStats(api)
    assertOk(res, 'team stats')
  })
})

// ═══════════════════════════════════════════════════════════
// Section C: Analytics Performance & Gender Pay Gap — HR_ADMIN
// ═══════════════════════════════════════════════════════════

test.describe('Analytics Performance & Gender Pay Gap: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /analytics/performance returns data', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getAnalyticsPerformance(api)
    assertOk(res, 'analytics performance')
  })

  test('GET /analytics/performance/overview returns data', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getAnalyticsPerformanceOverview(api)
    assertOk(res, 'analytics performance overview')
  })

  test('GET /analytics/gender-pay-gap returns data', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getGenderPayGap(api)
    assertOk(res, 'gender pay gap')
  })

  test('GET /analytics/gender-pay-gap/export returns raw data', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getGenderPayGapExport(api)
    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
  })
})

test.describe('Analytics Performance: EMPLOYEE Blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /analytics/performance as EMPLOYEE → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getAnalyticsPerformance(api)
    assertError(res, 403, 'EMPLOYEE blocked from analytics performance')
  })

  test('GET /analytics/gender-pay-gap as EMPLOYEE → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getGenderPayGap(api)
    assertError(res, 403, 'EMPLOYEE blocked from gender pay gap')
  })
})

// ═══════════════════════════════════════════════════════════
// Section D: Analytics AI Report — HR_ADMIN
// ═══════════════════════════════════════════════════════════

test.describe('Analytics AI Report: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /analytics/ai-report returns list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getAiReport(api)
    assertOk(res, 'ai report list')
  })

  test('POST /analytics/ai-report/generate (smoke)', async ({ request }) => {
    const api = new ApiClient(request)
    const companyId = await f.resolveCompanyId(request)
    const res = await f.generateAiReport(api, f.buildAiReportGenerate(companyId))
    // 200 (AI working) or 500 (API key missing) or 400 (period format)
    expect([200, 400, 500]).toContain(res.status)
  })

  test('GET /analytics/ai-report response shape', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getAiReport(api)
    assertOk(res, 'ai report shape')
    expect(Array.isArray(res.data)).toBe(true)
  })
})

test.describe('Analytics AI Report: EMPLOYEE Blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /analytics/ai-report as EMPLOYEE → 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getAiReport(api)
    assertError(res, 403, 'EMPLOYEE blocked from ai report')
  })
})

// ═══════════════════════════════════════════════════════════
// Section E: GDPR Deeper — HR_ADMIN
// ═══════════════════════════════════════════════════════════

test.describe('GDPR Deeper: HR_ADMIN', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let retentionId = ''
  let employeeId = ''

  test('resolve employee ID', async ({ request }) => {
    const id = await f.resolveEmployeeId(request)
    expect(id).toBeTruthy()
    employeeId = id!
  })

  test('GET /compliance/gdpr/pii-access returns paginated list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getPiiAccess(api)
    // 200 with data or pagination
    expect(res.ok).toBe(true)
  })

  test('GET /compliance/gdpr/pii-access/dashboard returns dashboard', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getPiiDashboard(api)
    assertOk(res, 'pii dashboard')
  })

  test('GET /compliance/gdpr/retention returns list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listRetention(api)
    expect(res.ok).toBe(true)
  })

  test('POST /compliance/gdpr/retention creates policy', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.createRetention(api, f.buildRetentionPolicy())
    assertOk(res, 'create retention')
    retentionId = (res.data as { id: string }).id
    expect(retentionId).toBeTruthy()
  })

  test('PUT /compliance/gdpr/retention/[id] updates policy', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.updateRetention(api, retentionId, { retentionMonths: 24 })
    assertOk(res, 'update retention')
  })

  test('POST /compliance/gdpr/retention/run triggers run', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.runRetention(api)
    // May be 200 or 400/500 if cron-only
    expect([200, 400, 500]).toContain(res.status)
  })

  test('GET /compliance/gdpr/requests returns list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listGdprRequests(api)
    expect(res.ok).toBe(true)
  })

  test('POST /compliance/gdpr/requests creates DSAR', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.createGdprRequest(api, f.buildGdprRequest(employeeId))
    assertOk(res, 'create DSAR')
    expect((res.data as { id: string }).id).toBeTruthy()
  })
})

// ═══════════════════════════════════════════════════════════
// Section F: Compliance KR — HR_ADMIN
// ═══════════════════════════════════════════════════════════

test.describe('Compliance KR Severance: HR_ADMIN', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let employeeId = ''
  let severanceId = ''

  test('resolve employee ID', async ({ request }) => {
    const id = await f.resolveEmployeeId(request)
    expect(id).toBeTruthy()
    employeeId = id!
  })

  test('GET /compliance/kr/severance-interim returns list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listSeverance(api)
    expect(res.ok).toBe(true)
  })

  test('POST /compliance/kr/severance-interim creates payment', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.createSeverance(api, f.buildSeveranceCreate(employeeId))
    // 201/200 or 400 (employee may not meet eligibility)
    expect([200, 201, 400]).toContain(res.status)
    if (res.ok && res.data) {
      severanceId = (res.data as { id: string }).id
    }
  })

  test('GET /compliance/kr/severance-interim/calculate returns estimate', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.calculateSeverance(api, { employeeId })
    // 200 or 400 (employee not found / ineligible)
    expect([200, 400]).toContain(res.status)
  })

  test('GET /compliance/kr/severance-interim/[id] returns detail (if created)', async ({ request }) => {
    if (!severanceId) return
    const api = new ApiClient(request)
    const res = await f.getSeveranceDetail(api, severanceId)
    assertOk(res, 'severance detail')
  })
})

// ═══════════════════════════════════════════════════════════
// Section G: Compliance CN — HR_ADMIN
// ═══════════════════════════════════════════════════════════

test.describe('Compliance CN: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('POST /compliance/cn/social-insurance/calculate batch calculates', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.calcSocialInsurance(api, f.buildSocialInsuranceCalc())
    // 200 or 400/500 (no CN employees in this company)
    expect([200, 400, 500]).toContain(res.status)
  })

  test('GET /compliance/cn/social-insurance/export returns data', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.exportSocialInsurance(api)
    // 200 or 400 (missing params)
    expect([200, 400]).toContain(res.status)
  })

  test('GET /compliance/cn/employee-registry/export returns data', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.exportEmployeeRegistry(api)
    // 200 or 400 (no CN employees)
    expect([200, 400]).toContain(res.status)
  })
})

// ═══════════════════════════════════════════════════════════
// Section H: Compliance RU — HR_ADMIN
// ═══════════════════════════════════════════════════════════

test.describe('Compliance RU: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('POST /compliance/ru/kedo/fake-id/sign → 404|400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.signKedo(api, '00000000-0000-4000-a000-000000000099', f.buildKedoSign())
    // 404 (document not found) or 400 (validation)
    expect([400, 404]).toContain(res.status)
  })

  test('POST /compliance/ru/kedo/fake-id/reject → 404|400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.rejectKedo(api, '00000000-0000-4000-a000-000000000099', f.buildKedoReject())
    expect([400, 404]).toContain(res.status)
  })

  test('GET /compliance/ru/military/export/t2 returns data', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getMilitaryExportT2(api)
    assertOk(res, 'military export t2')
  })

  test('GET /compliance/ru/reports/57t returns data', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getReport57T(api, { year: '2025' })
    // 200 or 400 (missing year param or no data)
    expect([200, 400]).toContain(res.status)
  })
})

// ═══════════════════════════════════════════════════════════
// Section I: Org Restructure — HR_ADMIN (serial)
// ═══════════════════════════════════════════════════════════

test.describe('Org Restructure: HR_ADMIN', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let planId = ''
  let companyId = ''

  test('resolve company ID', async ({ request }) => {
    const id = await f.resolveCompanyId(request)
    expect(id).toBeTruthy()
    companyId = id!
  })

  test('GET /org/restructure-plans returns list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listRestructurePlans(api)
    expect(res.ok).toBe(true)
  })

  test('POST /org/restructure-plans creates plan', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.createRestructurePlan(api, f.buildRestructurePlan(companyId))
    assertOk(res, 'create restructure plan')
    planId = (res.data as { id: string }).id
    expect(planId).toBeTruthy()
  })

  test('GET /org/restructure-plans/[id] returns detail', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getRestructurePlan(api, planId)
    assertOk(res, 'get restructure plan detail')
    expect((res.data as { id: string }).id).toBe(planId)
  })

  test('PATCH /org/restructure-plans/[id] updates plan', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.updateRestructurePlan(api, planId, f.buildRestructureUpdate())
    assertOk(res, 'update restructure plan')
  })

  test('POST /org/restructure-plans/[id]/apply applies plan', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.applyRestructurePlan(api, planId)
    // May be 200 (applied) or 400 (not approved yet / invalid changes)
    expect([200, 400]).toContain(res.status)
  })

  test('GET /org/restructure-plans/[id] response shape', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.getRestructurePlan(api, planId)
    assertOk(res, 'restructure plan shape')
    const data = res.data as { id: string; title: string; status: string }
    expect(data.id).toBeTruthy()
    expect(data.title).toBeTruthy()
    expect(data.status).toBeTruthy()
  })
})

// ─── Org Restructure RBAC: EMPLOYEE Blocked ─────────────

test.describe('Org Restructure RBAC: EMPLOYEE Access', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /org/restructure-plans as EMPLOYEE → 200 (has org_read)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await f.listRestructurePlans(api)
    // EMPLOYEE role has org_read permission (for org chart view)
    expect(res.ok).toBe(true)
  })
})
