// ═══════════════════════════════════════════════════════════
// Analytics 멀티테넌트 격리 — cross-tenant 읽기 누출 차단
// (multi-tenant-leak-hunt 워크플로 발견 / resolveCompanyFilter 회귀 방지)
//
// 시나리오: CTR-CN(해외) HR_ADMIN이 ?companyId=<CTR>/?company_id=<CTR>로
// analytics를 호출해도 resolveCompanyFilter가 본인 법인(CTR-CN)으로 강제 →
// CTR 데이터가 새지 않고 서버 에러(5xx)도 나지 않는다.
// SUPER_ADMIN은 파라미터 미지정 시 전 법인 통합뷰(carve-out).
//
// analytics는 읽기라 payroll(파괴적 쓰기 403)과 달리 "스코프 강제"가 핵심:
// 비-SUPER가 타법인 companyId를 넘겨도 200(또는 권한상 403)이며 5xx가 아니다.
// ═══════════════════════════════════════════════════════════

import { test, expect, request as playwrightRequest } from '@playwright/test'
import { ApiClient } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import { resolveCompanyId } from '../helpers/p12-fixtures'

// 누출 18개 GET 라우트 (형태별: params.companyId / searchParams / company_id 스키마)
// extra: 누출과 무관하게 라우트가 요구하는 필수 파라미터(예: drilldown의 type)
const GET_ROUTES: { path: string; param: 'companyId' | 'company_id'; extra?: Record<string, string> }[] = [
  { path: '/api/v1/analytics/executive/summary', param: 'companyId' },
  { path: '/api/v1/analytics/executive/drilldown', param: 'companyId', extra: { type: 'headcount' } },
  { path: '/api/v1/analytics/attendance/overview', param: 'companyId' },
  { path: '/api/v1/analytics/payroll/overview', param: 'companyId' },
  { path: '/api/v1/analytics/performance/overview', param: 'companyId' },
  { path: '/api/v1/analytics/turnover/overview', param: 'companyId' },
  { path: '/api/v1/analytics/team-health-scores', param: 'companyId' },
  { path: '/api/v1/analytics/ai-report', param: 'companyId' },
  { path: '/api/v1/analytics/prediction/burnout', param: 'companyId' },
  { path: '/api/v1/analytics/prediction/turnover', param: 'companyId' },
  { path: '/api/v1/analytics/overview', param: 'company_id' },
  { path: '/api/v1/analytics/attendance', param: 'company_id' },
  { path: '/api/v1/analytics/compensation', param: 'company_id' },
  { path: '/api/v1/analytics/performance', param: 'company_id' },
  { path: '/api/v1/analytics/recruitment', param: 'company_id' },
  { path: '/api/v1/analytics/team-health', param: 'company_id' },
  { path: '/api/v1/analytics/turnover', param: 'company_id' },
  { path: '/api/v1/analytics/workforce', param: 'company_id' },
]

test.describe('analytics cross-tenant isolation: 비-SUPER 자기 법인 강제', () => {
  let ctrCompanyId = ''

  test.beforeAll(async () => {
    // CTR(국내) HR_ADMIN 세션으로 CTR companyId 확보
    const ctrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    ctrCompanyId = (await resolveCompanyId(ctrReq)) ?? ''
    await ctrReq.dispose()
  })

  for (const { path, param, extra } of GET_ROUTES) {
    test(`${path} — CTR-CN HR이 ${param}=<CTR> 넘겨도 스코프 강제(5xx 없음)`, async () => {
      expect(ctrCompanyId, 'CTR companyId fixture must resolve').toBeTruthy()
      const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
      const res = await new ApiClient(cnReq).get(path, { ...(extra ?? {}), [param]: ctrCompanyId })
      // 가드가 본인 법인으로 강제 → 권한 에러 없이 자기 법인 응답, 서버 크래시 아님
      expect(res.status, `${path} must not 5xx (guard crash)`).toBeLessThan(500)
      expect([200, 403], `${path} unexpected status ${res.status}`).toContain(res.status)
      await cnReq.dispose()
    })
  }
})

test.describe('analytics cross-tenant: ai-report/generate(POST) 쓰기 소유권', () => {
  test('CTR-CN HR이 body.companyId=<CTR>로 생성해도 CTR에 쓰지 못함', async () => {
    const ctrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    const ctrCompanyId = (await resolveCompanyId(ctrReq)) ?? ''
    await ctrReq.dispose()
    expect(ctrCompanyId).toBeTruthy()

    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await new ApiClient(cnReq).post('/api/v1/analytics/ai-report/generate', {
      companyId: ctrCompanyId,
      period: '2020-01', // 과거 period — 실 데이터 영향 최소화
    })
    // 가드(resolveCompanyId)는 AI 생성 전. 생성 성공 시 companyId가 CTR-CN으로 강제됨.
    if ((res.status === 200 || res.status === 202) && res.data) {
      const written = (res.data as { companyId?: string }).companyId
      if (written) {
        expect(written, 'must NOT write to requested CTR company').not.toBe(ctrCompanyId)
      }
    }
    // 4xx/5xx(환경 의존 AI 키 등)는 단언하지 않음 — 어느 경우든 CTR에 쓰지 않음
    await cnReq.dispose()
  })
})

test.describe('analytics: SUPER_ADMIN 통합뷰 carve-out 보존', () => {
  test('SUPER_ADMIN이 파라미터 없이 overview → 200 통합뷰(차단 아님)', async () => {
    const suReq = await playwrightRequest.newContext({ storageState: authFile('SUPER_ADMIN') })
    const res = await new ApiClient(suReq).get('/api/v1/analytics/overview')
    expect(res.status, 'SUPER 통합뷰는 200이어야').toBe(200)
    await suReq.dispose()
  })
})

// ─────────────────────────────────────────────────────────────
// 값-수준 격리 회귀 가드 (status-only 가드가 놓친 본문 누출)
// attendance/overview·ai-report 의 휴가 사용률/위험인원은 과거 company 필터 없이 전 법인을
// 집계했음(레거시 employee_leave_balances·Employee 가 unscoped) → 비-SUPER HR 에 타법인 값 누출.
// 누출 시 모든 법인이 동일한 "전사 블렌드"를 봄. 법인별로 다른 값이면 per-company 스코프 작동.
// ─────────────────────────────────────────────────────────────
test.describe('analytics cross-tenant: leave KPI 값 격리', () => {
  test('attendance/overview leaveUsageRate 가 비-SUPER 호출자 법인으로 격리된다', async () => {
    // 각 법인 HR 이 파라미터 없이 호출 → resolveCompanyFilter 가 본인 법인 강제(보안 핵심).
    // 누출 시 둘 다 전사 블렌드로 동일, per-company 스코프 시 법인별 상이.
    const ctrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    type Kpis = { kpis: { leaveUsageRate: { value: number } } }
    const a = await new ApiClient(ctrReq).get<Kpis>('/api/v1/analytics/attendance/overview')
    const b = await new ApiClient(cnReq).get<Kpis>('/api/v1/analytics/attendance/overview')
    await ctrReq.dispose()
    await cnReq.dispose()

    expect(a.status, 'CTR HR overview 200').toBe(200)
    expect(b.status, 'CTR-CN HR overview 200').toBe(200)
    const rateA = a.data?.kpis.leaveUsageRate.value ?? -1
    const rateB = b.data?.kpis.leaveUsageRate.value ?? -1
    // 두 법인 모두 휴가 데이터 보유 → 사용률 > 0 (가드가 vacuous 하지 않음을 보장)
    expect(rateA, 'CTR leaveUsageRate 존재').toBeGreaterThan(0)
    expect(rateB, 'CTR-CN leaveUsageRate 존재').toBeGreaterThan(0)
    // 핵심 가드: 두 법인 사용률이 같으면 cross-tenant 집계 누출(전사 블렌드)
    expect(rateA, '법인별 사용률 분리 — 동일하면 누출 회귀').not.toBe(rateB)
  })
})
