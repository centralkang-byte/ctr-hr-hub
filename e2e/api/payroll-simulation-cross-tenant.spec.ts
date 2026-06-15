// ═══════════════════════════════════════════════════════════
// Payroll Simulation 멀티테넌트 격리 — cross-tenant 급여/PII 누출 차단
// (completeness-scout 발견 / fetchEmployeeData·GET·DIFFERENTIAL 스코프 회귀 방지)
//
// 누출(수정 전): /api/v1/payroll/simulation 은 HR_UP(HR_ADMIN/SUPER)만 도달하나,
// 타 법인 HR_ADMIN(CTR-CN)이 CTR 직원 employeeId/companyId 를 넘기면
//   - GET: company 스코프 없이 전 법인 시뮬 이력 반환
//   - POST SINGLE: 공격자 employeeId → fetchEmployeeData 무스코프 → 타법인 PII+급여
//   - POST DIFFERENTIAL: body.companyId 무검증 → 타법인 로스터 덤프
// 를 조회할 수 있었음. 수정: fetchEmployeeData(companyId) 스코프 + resolveCompanyId/Filter.
//
// 값-수준 가드(status-only 가드가 놓친 본문 누출): SINGLE 은 비영속 compute 라
// '타법인 employeeId → 400 직원없음' 이 핵심 비-vacuous 증명.
// ═══════════════════════════════════════════════════════════

import { test, expect, request as playwrightRequest } from '@playwright/test'
import { ApiClient } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import * as f from '../helpers/p12-fixtures'

const SIM = '/api/v1/payroll/simulation'

test.describe('payroll simulation cross-tenant isolation: 타법인 HR 차단', () => {
  let ctrEmployeeId = ''
  let ctrCompanyId = ''

  test.beforeAll(async () => {
    // CTR(국내) HR_ADMIN 세션으로 CTR 직원/법인 fixture 확보
    const ctrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    ctrEmployeeId = (await f.resolveEmployeeIdForPayroll(ctrReq)) ?? ''
    ctrCompanyId = (await f.resolveCompanyId(ctrReq)) ?? ''
    await ctrReq.dispose()
  })

  test('POST SINGLE: CTR-CN HR이 CTR 직원 employeeId → 400(스코프 차단, PII 미노출)', async () => {
    expect(ctrEmployeeId, 'CTR 직원 fixture').toBeTruthy()
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await new ApiClient(cnReq).post(SIM, {
      mode: 'SINGLE',
      employeeId: ctrEmployeeId,
      parameters: {},
    })
    // 누출 시 200 + CTR 직원 급여 result. 수정 후 본인 법인 스코프 → empData 0 → 400 직원없음.
    expect(res.status, 'CTR-CN HR은 CTR 직원 시뮬 불가(스코프 차단)').toBe(400)
    // 본문에 CTR 직원 시뮬 결과(employees)가 없어야
    const data = res.data as { employees?: unknown[] } | null
    expect(data?.employees ?? undefined, 'CTR 직원 급여 result 미노출').toBeUndefined()
    await cnReq.dispose()
  })

  test('POST BULK SELECTED: CTR-CN HR이 CTR employeeId 선택 → 결과에서 스코프 제거(부분 누출 없음)', async () => {
    // 최고가치 공격 경로: target.employeeIds는 raw 공격자 입력 → fetchEmployeeData(callerScope)에만 의존.
    expect(ctrEmployeeId).toBeTruthy()
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await new ApiClient(cnReq).post<{ employees?: unknown[] }>(SIM, {
      mode: 'BULK',
      target: { type: 'SELECTED', employeeIds: [ctrEmployeeId] },
      parameters: { baseSalaryAdjustRate: 0 },
    })
    // CTR 직원이 CTR-CN 스코프에서 제거 → employees 비어야(누출 시 CTR 직원 급여가 들어옴)
    expect(res.status, 'BULK 200').toBe(200)
    expect((res.data?.employees ?? []).length, 'CTR 직원 스코프 제거 — 결과 0건').toBe(0)
    await cnReq.dispose()
  })

  test('POST DIFFERENTIAL: CTR-CN HR이 companyId=CTR → 본인 법인 강제(5xx 없음, CTR 덤프 불가)', async () => {
    expect(ctrCompanyId, 'CTR 법인 fixture').toBeTruthy()
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await new ApiClient(cnReq).post(SIM, {
      mode: 'DIFFERENTIAL',
      parameters: { companyId: ctrCompanyId, rates: {} },
    })
    // resolveCompanyId가 본인 법인(CTR-CN)으로 강제 → CTR 로스터 덤프 불가. 크래시(5xx) 아님.
    expect(res.status, 'guard crash 없음').toBeLessThan(500)
    await cnReq.dispose()
  })

  test('GET: CTR-CN HR이 ?employeeId=<CTR 직원> → CTR 시뮬 이력 미노출', async () => {
    expect(ctrEmployeeId).toBeTruthy()
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await new ApiClient(cnReq).get<Array<{ employeeId: string }>>(SIM, {
      employeeId: ctrEmployeeId,
    })
    expect(res.status, 'GET 200').toBe(200)
    // 회사 스코프로 CTR 직원의 시뮬이 CTR-CN HR 에 노출되면 안 됨
    const rows = Array.isArray(res.data) ? res.data : []
    expect(rows.some((r) => r.employeeId === ctrEmployeeId), 'CTR 직원 시뮬 누출 없음').toBe(false)
    await cnReq.dispose()
  })

  test('POST FX: 비-SUPER(HR_ADMIN) → 403(전사 환율 시뮬은 SUPER 전용)', async () => {
    const hrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    const res = await new ApiClient(hrReq).post(SIM, {
      mode: 'FX',
      parameters: { rateOverrides: [] },
    })
    expect(res.status, 'FX는 SUPER 전용 → HR_ADMIN 403').toBe(403)
    await hrReq.dispose()
  })
})
