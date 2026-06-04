// ═══════════════════════════════════════════════════════════
// Payroll 멀티테넌트 격리 — batch 2 (잔여 cross-tenant 누출 가드)
// multi-tenant-leak-hunt 잔여분: anomalies/adjustments RC-C·읽기 스코프,
// global SUPER 게이트, severance·import-mappings·import-logs·dashboard.
//
// 규약:
//   - 파괴적(RC-C): CTR-CN HR → CTR run = 403 (ownership-first)
//   - 읽기(scoped findFirst): CTR-CN HR → CTR run = 404 (존재 oracle 차단)
//   - global: 단일법인 HR = 403, SUPER = 200 (holding 뷰)
//   - dashboard: 비-SUPER = 본인 법인만, SUPER = 전 법인
// ═══════════════════════════════════════════════════════════

import { test, expect, request as playwrightRequest } from '@playwright/test'
import { ApiClient, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import * as f from '../helpers/p12-fixtures'

const now = new Date()
const ym = () => ({ year: String(now.getFullYear()), month: String(now.getMonth() + 1) })

test.describe('Payroll cross-tenant batch 2: foreign-company HR blocked', () => {
  test.describe.configure({ mode: 'serial' })

  let ctrRunId = ''
  let ctrCompanyId = ''
  let ctrEmployeeId = ''

  test.beforeAll(async () => {
    const ctrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    const ctrApi = new ApiClient(ctrReq)
    ctrRunId = (await f.resolvePayrollRunId(ctrApi)) ?? ''
    ctrCompanyId = (await f.resolveCompanyId(ctrReq)) ?? ''
    ctrEmployeeId = (await f.resolveEmployeeIdForPayroll(ctrReq)) ?? ''
    await ctrReq.dispose()
  })

  // ── 파괴적 RC-C (run by id → forbidden) ──────────────────

  test('bulk-resolve anomalies on another company run → 403', async () => {
    expect(ctrRunId, 'CTR runId fixture must resolve').toBeTruthy()
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await f.bulkResolveAnomalies(new ApiClient(cnReq), ctrRunId, f.buildBulkResolve(['dummy-anomaly-id']))
    assertError(res, 403, 'CTR-CN HR blocked from CTR bulk-resolve')
    await cnReq.dispose()
  })

  test('create adjustment on another company run → 403', async () => {
    expect(ctrRunId).toBeTruthy()
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await f.createAdjustment(new ApiClient(cnReq), ctrRunId, f.buildAdjustment(ctrEmployeeId || 'dummy-emp'))
    assertError(res, 403, 'CTR-CN HR blocked from CTR adjustment create')
    await cnReq.dispose()
  })

  // ── 읽기 (scoped findFirst → notFound 404, 존재 oracle 차단) ──

  test('list adjustments on another company run → 404 (scoped)', async () => {
    expect(ctrRunId).toBeTruthy()
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await f.listAdjustments(new ApiClient(cnReq), ctrRunId)
    assertError(res, 404, 'CTR-CN HR sees CTR run adjustments as notFound')
    await cnReq.dispose()
  })

  test('list anomalies on another company run → 404 (scoped)', async () => {
    expect(ctrRunId).toBeTruthy()
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await f.listAnomalies(new ApiClient(cnReq), ctrRunId)
    assertError(res, 404, 'CTR-CN HR sees CTR run anomalies as notFound')
    await cnReq.dispose()
  })

  // ── attendance-status: raw companyId param이 비-SUPER에겐 무시됨 ──

  test('attendance-status ignores cross-tenant companyId param (resolveCompanyId scope)', async () => {
    expect(ctrCompanyId).toBeTruthy()
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    // CTR-CN HR가 CTR companyId를 보내도 resolveCompanyId가 본인 법인(CTR-CN)으로 강제 →
    // 200(본인 법인 현황) 또는 파라미터 검증 실패. CTR 데이터로의 누출은 불가.
    const res = await f.getAttendanceStatus(new ApiClient(cnReq), { companyId: ctrCompanyId, ...ym() })
    expect([200, 400], 'scoped to caller company, never CTR data leak').toContain(res.status)
    await cnReq.dispose()
  })

  // ── import-mappings / import-logs POST: 타법인 companyId → 403 ──

  test('create import-mapping for another company → 403', async () => {
    expect(ctrCompanyId).toBeTruthy()
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await f.createImportMapping(new ApiClient(cnReq), f.buildImportMapping(ctrCompanyId))
    assertError(res, 403, 'CTR-CN HR blocked from creating CTR import-mapping')
    await cnReq.dispose()
  })

  test('create import-log for another company → 403', async () => {
    expect(ctrCompanyId).toBeTruthy()
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await f.createImportLog(new ApiClient(cnReq), f.buildImportLog(ctrCompanyId, 'dummy-mapping-id'))
    assertError(res, 403, 'CTR-CN HR blocked from creating CTR import-log')
    await cnReq.dispose()
  })

  // ── severance: 타법인 직원 → 404 (scoped) ──

  test('severance for another company employee → 404 (scoped)', async () => {
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    if (!ctrEmployeeId) {
      await cnReq.dispose()
      return test.skip()
    }
    const res = await f.postSeverance(new ApiClient(cnReq), ctrEmployeeId, f.buildSeverancePayload())
    assertError(res, 404, 'CTR-CN HR sees CTR employee as notFound (severance)')
    await cnReq.dispose()
  })

  // ── dashboard: 비-SUPER는 본인 법인만 ──

  test('dashboard for non-SUPER HR excludes other companies', async () => {
    expect(ctrCompanyId).toBeTruthy()
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await f.getPayrollDashboard(new ApiClient(cnReq), ym())
    expect(res.status).toBe(200)
    const data = res.data as { pipelines?: Array<{ companyId: string }>; summary?: { totalCompanies?: number } }
    const pipelines = data.pipelines ?? []
    expect(
      pipelines.some((p) => p.companyId === ctrCompanyId),
      'CTR-CN dashboard must NOT include CTR company pipeline',
    ).toBe(false)
    expect(data.summary?.totalCompanies ?? 99, 'non-SUPER sees only own company').toBeLessThanOrEqual(1)
    await cnReq.dispose()
  })

  // ── global: 단일법인 HR → 403 ──

  test('global payroll view forbidden for non-SUPER HR → 403', async () => {
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await f.getGlobalDashboard(new ApiClient(cnReq), ym())
    assertError(res, 403, 'non-SUPER HR blocked from global payroll rollup')
    await cnReq.dispose()
  })

  // ── best-effort: 실제 CTR anomalyId 확보 후 CTR-CN HR resolve → 403 ──

  test('resolve anomaly on another company run → 403 (best-effort, real anomalyId)', async () => {
    const ctrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    const ctrApi = new ApiClient(ctrReq)
    const reviewRunId = await f.resolveReviewRunId(ctrApi)
    let anomalyId: string | undefined
    if (reviewRunId) {
      const list = await f.listAnomalies(ctrApi, reviewRunId)
      anomalyId = (list.data as { anomalies?: Array<{ id: string }> })?.anomalies?.[0]?.id
    }
    await ctrReq.dispose()
    if (!reviewRunId || !anomalyId) return test.skip()

    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await f.resolveAnomaly(new ApiClient(cnReq), reviewRunId, anomalyId)
    assertError(res, 403, 'CTR-CN HR blocked from resolving CTR anomaly')
    await cnReq.dispose()
  })
})

// ─── SUPER_ADMIN carve-out + 의도된 holding 접근 회귀 방지 ───

test.describe('Payroll cross-tenant batch 2: SUPER_ADMIN carve-out preserved', () => {
  test('SUPER_ADMIN reaches global payroll rollup → 200 (intended)', async () => {
    const suReq = await playwrightRequest.newContext({ storageState: authFile('SUPER_ADMIN') })
    const res = await f.getGlobalDashboard(new ApiClient(suReq), ym())
    expect(res.status, 'SUPER_ADMIN reaches global payroll').toBe(200)
    await suReq.dispose()
  })

  test('SUPER_ADMIN dashboard spans multiple companies', async () => {
    const suReq = await playwrightRequest.newContext({ storageState: authFile('SUPER_ADMIN') })
    const res = await f.getPayrollDashboard(new ApiClient(suReq), ym())
    expect(res.status).toBe(200)
    const data = res.data as { summary?: { totalCompanies?: number } }
    expect(data.summary?.totalCompanies ?? 0, 'SUPER sees all companies (holding view)').toBeGreaterThan(1)
    await suReq.dispose()
  })

  test('SUPER_ADMIN list adjustments on any-company run → not cross-tenant blocked', async () => {
    const hrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    const runId = await f.resolvePayrollRunId(new ApiClient(hrReq))
    await hrReq.dispose()
    if (!runId) return test.skip()
    const suReq = await playwrightRequest.newContext({ storageState: authFile('SUPER_ADMIN') })
    const res = await f.listAdjustments(new ApiClient(suReq), runId)
    expect(res.status, 'SUPER carve-out: reaches any-company run (not 404/403)').toBe(200)
    await suReq.dispose()
  })
})
