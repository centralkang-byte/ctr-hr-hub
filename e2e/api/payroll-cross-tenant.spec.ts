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
import { ApiClient, assertError, assertOk } from '../helpers/api-client'
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

  // ── S285: 읽기(404) 패턴을 쓰던 write 라우트를 정식 write 가드(403 소유권-우선)로 정합 ──
  // CEO 결정: SUPER = 전 법인 운영자(write 포함). 비-SUPER는 status/항목 무관 403(소유권 가드가
  // findUnique 직후·status·item·body 파싱보다 앞 → 부수효과 없이 차단). 같은 버그군 회귀 고정.
  test('mark-paid on another company run → 403', async () => {
    expect(ctrRunId).toBeTruthy()
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await f.markPaid(new ApiClient(cnReq), ctrRunId)
    assertError(res, 403, 'CTR-CN HR blocked from CTR mark-paid')
    await cnReq.dispose()
  })

  test('notify-unread on another company run → 403', async () => {
    expect(ctrRunId).toBeTruthy()
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await f.notifyUnread(new ApiClient(cnReq), ctrRunId)
    assertError(res, 403, 'CTR-CN HR blocked from CTR notify-unread')
    await cnReq.dispose()
  })

  test('item adjust on another company run → 403', async () => {
    expect(ctrRunId).toBeTruthy()
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await f.adjustItem(new ApiClient(cnReq), ctrRunId, 'any-item-id')
    assertError(res, 403, 'CTR-CN HR blocked from CTR item adjust')
    await cnReq.dispose()
  })

  test('export/transfer on another company run → 403', async () => {
    expect(ctrRunId).toBeTruthy()
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await f.exportTransfer(new ApiClient(cnReq), ctrRunId)
    expect(res.status, 'CTR-CN HR blocked from CTR transfer batch write').toBe(403)
    await cnReq.dispose()
  })

  test('per-run calculate on another company run → 403', async () => {
    expect(ctrRunId).toBeTruthy()
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await f.perRunCalculate(new ApiClient(cnReq), ctrRunId)
    assertError(res, 403, 'CTR-CN HR blocked from CTR per-run calculate')
    await cnReq.dispose()
  })
})

// ─── SUPER_ADMIN carve-out: 전 법인 접근 허용(가드 통과) 회귀 방지 ───

test.describe('Payroll cross-tenant: SUPER_ADMIN carve-out preserved', () => {
  test.describe.configure({ mode: 'serial' })

  let suRunId = ''

  test.beforeAll(async () => {
    // HR_ADMIN(CTR)이 확보한 run에 SUPER_ADMIN(CTR-HOLD)이 접근 — 타 법인 carve-out 검증 대상.
    const hrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    suRunId = (await f.resolvePayrollRunId(new ApiClient(hrReq))) ?? ''
    await hrReq.dispose()
  })

  test('attendance-reopen: SUPER_ADMIN reaches another-company run (not 403)', async () => {
    if (!suRunId) return test.skip()
    const suReq = await playwrightRequest.newContext({ storageState: authFile('SUPER_ADMIN') })
    // status 가드(400)나 성공(200)은 가능하나 cross-tenant 403은 아니어야 함
    const res = await f.postAttendanceReopen(new ApiClient(suReq), f.buildAttendanceReopen(suRunId))
    expect(res.status, 'SUPER_ADMIN carve-out: must not hit cross-tenant 403').not.toBe(403)
    await suReq.dispose()
  })

  // S285: carve-out 강검증 — `!= 403`만으론 (옛 own-only findFirst→null) 404도 통과해버린다.
  // findUnique({id})가 run을 찾으므로 핸들러 도달 = 403도 404도 아님. status 비변이 라우트만
  // 성공-프로브(부수효과로 공유 시드 오염 회피); paid·per-run-calculate는 동일 가드 코드라
  // 위 403 테스트 + 이 프로브로 커버.
  test('export/transfer: SUPER_ADMIN reaches handler (not 403/404)', async () => {
    if (!suRunId) return test.skip()
    const suReq = await playwrightRequest.newContext({ storageState: authFile('SUPER_ADMIN') })
    const res = await f.exportTransfer(new ApiClient(suReq), suRunId)
    // 200(파일 생성)·400(status 가드) 모두 소유권 통과 증거 — 403/404면 carve-out 깨짐
    expect([200, 400], `SUPER reaches transfer handler (got ${res.status})`).toContain(res.status)
    await suReq.dispose()
  })

  test('notify-unread: SUPER_ADMIN reaches handler (not 403/404)', async () => {
    if (!suRunId) return test.skip()
    const suReq = await playwrightRequest.newContext({ storageState: authFile('SUPER_ADMIN') })
    const res = await f.notifyUnread(new ApiClient(suReq), suRunId)
    // 200(발송/0건)·400(status 가드) 모두 소유권 통과 증거 — run status 비변이라 오염 없음
    expect([200, 400], `SUPER reaches notify-unread handler (got ${res.status})`).toContain(res.status)
    await suReq.dispose()
  })

  // item-adjust carve-out: fake itemId → run 소유권 통과 후 status-gate(400) 또는 item notFound(404) —
  // 둘 다 run status를 바꾸지 않아(update 미실행) 공유 시드 비오염. 403만 아니면 carve-out 통과.
  test('item adjust: SUPER_ADMIN reaches handler (not cross-tenant 403)', async () => {
    if (!suRunId) return test.skip()
    const suReq = await playwrightRequest.newContext({ storageState: authFile('SUPER_ADMIN') })
    const res = await f.adjustItem(new ApiClient(suReq), suRunId, 'nonexistent-item-id')
    expect(res.status, 'SUPER item-adjust carve-out: not cross-tenant 403').not.toBe(403)
    await suReq.dispose()
  })

  // NOTE: mark-paid·per-run-calculate carve-out 성공-프로브는 의도적으로 생략한다.
  // 두 라우트는 run.status를 변이(APPROVED→PAID / DRAFT·ATTENDANCE_CLOSED→계산실행→ADJUSTMENT)시켜
  // 공유 시드를 오염 → 결재 파이프라인 등 stateful 스펙을 연쇄 실패시킨다([[hrhub-e2e-shared-seed-pollution]]).
  // 가드는 위 transfer/notify/item-adjust와 byte-identical 복제이고, 각자의 비-SUPER 403 테스트가
  // 가드 배선을 증명하므로 carve-out 방향은 그 셋으로 충분히 커버된다.
})

// ─── 목록(GET /runs) 스코프: SUPER 전 법인 / 비-SUPER fail-closed (CEO S285) ───
// run 상세 read는 #154에서 전 법인 개방됐으나 목록은 미개방이었음. S286에서 목록도
// resolveCompanyFilter로 통일 — SUPER는 ?companyId 지정 시 해당 법인·미지정 시 전체,
// 비-SUPER는 요청 파라미터 무시·본인 법인 강제. 읽기 전용이라 부수효과 없음.
test.describe('Payroll cross-tenant: runs list scope', () => {
  test.describe.configure({ mode: 'serial' })

  let ctrRunId = ''
  let ctrCompanyId = ''

  test.beforeAll(async () => {
    const ctrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    ctrRunId = (await f.resolvePayrollRunId(new ApiClient(ctrReq))) ?? ''
    ctrCompanyId = (await f.resolveCompanyId(ctrReq)) ?? ''
    await ctrReq.dispose()
  })

  test('non-SUPER: ?companyId=다른법인 무시 — 본인 법인 강제 (fail-closed)', async () => {
    expect(ctrCompanyId, 'CTR companyId fixture must resolve').toBeTruthy()
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    // CTR-CN HR가 CTR companyId를 파라미터로 보내도 목록엔 CTR run이 절대 새어나오면 안 됨
    const res = await f.listRuns(new ApiClient(cnReq), { companyId: ctrCompanyId, limit: '100' })
    assertOk(res, 'CN HR lists runs (own scope)')
    const items = res.data as Array<{ id: string; companyId: string }>
    expect(
      items.every((r) => r.companyId !== ctrCompanyId),
      'CN HR must NOT see CTR runs via companyId param',
    ).toBe(true)
    await cnReq.dispose()
  })

  test('SUPER: ?companyId=CTR → 해당 법인만 (param 스코프)', async () => {
    expect(ctrCompanyId).toBeTruthy()
    expect(ctrRunId, 'CTR runId fixture must resolve').toBeTruthy()
    const suReq = await playwrightRequest.newContext({ storageState: authFile('SUPER_ADMIN') })
    const res = await f.listRuns(new ApiClient(suReq), { companyId: ctrCompanyId, limit: '100' })
    assertOk(res, 'SUPER lists CTR runs by param')
    const items = res.data as Array<{ id: string; companyId: string }>
    expect(items.length, 'SUPER scoped list returns CTR runs').toBeGreaterThan(0)
    expect(
      items.every((r) => r.companyId === ctrCompanyId),
      'SUPER ?companyId scope returns only that company',
    ).toBe(true)
    expect(items.some((r) => r.id === ctrRunId), 'known CTR run present in scoped list').toBe(true)
    await suReq.dispose()
  })

  test('SUPER: 파라미터 미지정 → 전 법인 (CTR-HOLD가 CTR run 가시 = cross-company)', async () => {
    expect(ctrCompanyId).toBeTruthy()
    const suReq = await playwrightRequest.newContext({ storageState: authFile('SUPER_ADMIN') })
    // SUPER(CTR-HOLD)가 companyId 미지정으로 목록 조회 → 본인 법인 아닌 CTR run이 보여야 함
    const res = await f.listRuns(new ApiClient(suReq), { limit: '100' })
    assertOk(res, 'SUPER lists all-company runs')
    const items = res.data as Array<{ id: string; companyId: string }>
    expect(
      items.some((r) => r.companyId === ctrCompanyId),
      'SUPER unscoped list spans companies (CTR run visible)',
    ).toBe(true)
    await suReq.dispose()
  })
})
