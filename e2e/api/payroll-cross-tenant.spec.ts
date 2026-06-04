// ═══════════════════════════════════════════════════════════
// Payroll 멀티테넌트 격리 — cross-tenant 파괴적 쓰기 차단
// (multi-tenant-leak-hunt 워크플로 발견 / RC-C·RC-B 가드 회귀 방지)
//
// 시나리오: CTR-CN(해외) HR_ADMIN이 CTR(국내) payroll run에 파괴적
// 작업을 시도 → companyId 소유권 가드로 403. attendance-close는
// resolveCompanyId로 본인 법인 강제(cross-tenant write 불가).
//
// 가드는 status/anomaly/domestic 체크보다 앞에 있으므로 run 상태와
// 무관하게 403이 떨어져야 한다(소유권 우선).
// ═══════════════════════════════════════════════════════════

import { test, expect, request as playwrightRequest } from '@playwright/test'
import { ApiClient, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import * as f from '../helpers/p12-fixtures'

test.describe('Payroll cross-tenant isolation: foreign-company HR blocked', () => {
  test.describe.configure({ mode: 'serial' })

  let ctrRunId = ''
  let ctrCompanyId = ''

  test.beforeAll(async () => {
    // CTR(국내) HR_ADMIN 세션으로 대상 run / companyId 확보
    const ctrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    const ctrApi = new ApiClient(ctrReq)
    ctrRunId = (await f.resolvePayrollRunId(ctrApi)) ?? ''
    ctrCompanyId = (await f.resolveCompanyId(ctrReq)) ?? ''
    await ctrReq.dispose()
  })

  test('attendance-reopen on another company run → 403', async () => {
    expect(ctrRunId, 'CTR runId fixture must resolve').toBeTruthy()
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await f.postAttendanceReopen(new ApiClient(cnReq), f.buildAttendanceReopen(ctrRunId))
    assertError(res, 403, 'CTR-CN HR blocked from CTR attendance-reopen')
    await cnReq.dispose()
  })

  test('calculate on another company run → 403', async () => {
    expect(ctrRunId).toBeTruthy()
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await f.postCalculate(new ApiClient(cnReq), f.buildCalculatePayload(ctrRunId))
    assertError(res, 403, 'CTR-CN HR blocked from CTR calculate')
    await cnReq.dispose()
  })

  test('adjustments/complete on another company run → 403', async () => {
    expect(ctrRunId).toBeTruthy()
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await f.completeAdjustments(new ApiClient(cnReq), ctrRunId)
    assertError(res, 403, 'CTR-CN HR blocked from CTR adjustments/complete')
    await cnReq.dispose()
  })

  test('submit-for-approval on another company run → 403', async () => {
    expect(ctrRunId).toBeTruthy()
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await f.submitForApproval(new ApiClient(cnReq), ctrRunId)
    assertError(res, 403, 'CTR-CN HR blocked from CTR submit-for-approval')
    await cnReq.dispose()
  })

  test('attendance-close ignores cross-tenant companyId (scoped to caller company)', async () => {
    expect(ctrCompanyId, 'CTR companyId fixture must resolve').toBeTruthy()
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    // CTR-CN HR가 CTR companyId를 보내도 resolveCompanyId가 본인 법인(CTR-CN)으로 강제
    const res = await f.postAttendanceClose(new ApiClient(cnReq), f.buildAttendanceClose(ctrCompanyId))
    if (res.status === 200) {
      const result = res.data as { payrollRun: { companyId: string } }
      expect(result.payrollRun.companyId, 'must NOT write to requested CTR company').not.toBe(ctrCompanyId)
    } else {
      // 이미 마감/조건 불충족 — 어느 경우든 요청한 CTR 법인 run은 건드리지 않음
      expect([200, 409, 400]).toContain(res.status)
    }
    await cnReq.dispose()
  })
})

// ─── SUPER_ADMIN carve-out: 전 법인 접근 허용(가드 통과) 회귀 방지 ───

test.describe('Payroll cross-tenant: SUPER_ADMIN carve-out preserved', () => {
  test('SUPER_ADMIN reaches another-company payroll run (carve-out, not 403)', async () => {
    // HR_ADMIN(CTR)이 확보한 run에 SUPER_ADMIN(CTR-HOLD)이 접근 — 타 법인이라도
    // 가드의 SUPER_ADMIN carve-out으로 cross-tenant 403이 아니어야 한다.
    const hrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    const runId = await f.resolvePayrollRunId(new ApiClient(hrReq))
    await hrReq.dispose()
    if (!runId) return test.skip()

    const suReq = await playwrightRequest.newContext({ storageState: authFile('SUPER_ADMIN') })
    // status 가드(400)나 성공(200)은 가능하나 cross-tenant 403은 아니어야 함
    const res = await f.postAttendanceReopen(new ApiClient(suReq), f.buildAttendanceReopen(runId))
    expect(res.status, 'SUPER_ADMIN carve-out: must not hit cross-tenant 403').not.toBe(403)
    await suReq.dispose()
  })
})
