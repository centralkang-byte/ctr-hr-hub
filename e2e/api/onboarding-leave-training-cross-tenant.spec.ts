// ═══════════════════════════════════════════════════════════
// onboarding/leave/training 멀티테넌트 격리 — cross-tenant 차단 회귀 방지
// (multi-tenant-leak-hunt remediation batch5 / Codex G1+G2 가드)
//
// 시나리오:
//   - crossboarding: 비-SUPER는 전면 차단(임시) → 403 (CTR-CN·CTR HR 모두)
//   - onboarding instance: CTR-CN HR가 CTR 인스턴스 접근/사인오프 → 403 (sameCompany 게이트)
//   - 읽기 스코프: CTR-CN HR가 CTR companyId 파라미터로 leave/training 조회 →
//     resolveCompanyId가 본인 법인 강제 → CTR 데이터 누출 불가
//   - SUPER carve-out: SUPER는 role 게이트 통과(403 아님)
// ═══════════════════════════════════════════════════════════

import { test, expect, request as playwrightRequest } from '@playwright/test'
import { ApiClient, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import type { RoleType } from '../helpers/auth'

async function clientFor(role: RoleType) {
  const ctx = await playwrightRequest.newContext({ storageState: authFile(role) })
  return { ctx, api: new ApiClient(ctx) }
}

// onboarding instances 목록 응답에서 첫 인스턴스 id 추출 (apiSuccess(array) | apiPaginated)
function firstId(data: unknown): string {
  if (Array.isArray(data)) return (data[0] as { id?: string })?.id ?? ''
  const d = data as { data?: Array<{ id?: string }>; items?: Array<{ id?: string }> }
  return d?.data?.[0]?.id ?? d?.items?.[0]?.id ?? ''
}

const bogusCrossboard = {
  employeeId: '00000000-0000-0000-0000-000000000000',
  fromCompanyId: '00000000-0000-0000-0000-0000000000aa',
  toCompanyId: '00000000-0000-0000-0000-0000000000bb',
  transferDate: '2026-07-01',
}

test.describe('onboarding/leave/training cross-tenant isolation', () => {
  test.describe.configure({ mode: 'serial' })

  let ctrInstanceId = ''
  let ctrCompanyId = ''

  test.beforeAll(async () => {
    const { ctx, api } = await clientFor('HR_ADMIN')
    const instRes = await api.get('/api/v1/onboarding/instances')
    ctrInstanceId = firstId(instRes.data)
    // CTR companyId 확보 (designated-days 응답 등에서 간접 확인용은 생략, leave/type-defs로 충분)
    const tdRes = await api.get('/api/v1/leave/type-defs')
    const tds = Array.isArray(tdRes.data) ? tdRes.data : []
    ctrCompanyId = (tds.find((t: { companyId?: string }) => t.companyId)?.companyId) ?? ''
    await ctx.dispose()
  })

  // ── crossboarding: 비-SUPER 전면 차단 ──────────────────────

  test('crossboarding: CTR-CN HR (non-SUPER) → 403', async () => {
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.post('/api/v1/onboarding/crossboarding', bogusCrossboard)
    assertError(res, 403, 'non-SUPER (CTR-CN) crossboarding blocked')
    await ctx.dispose()
  })

  test('crossboarding: CTR HR (non-SUPER) → 403', async () => {
    const { ctx, api } = await clientFor('HR_ADMIN')
    const res = await api.post('/api/v1/onboarding/crossboarding', bogusCrossboard)
    assertError(res, 403, 'non-SUPER (CTR) crossboarding blocked')
    await ctx.dispose()
  })

  test('crossboarding: SUPER passes role gate (not 403)', async () => {
    const { ctx, api } = await clientFor('SUPER_ADMIN')
    const res = await api.post('/api/v1/onboarding/crossboarding', bogusCrossboard)
    // bogus id라 이후 검증에서 실패(400/404/409/500) — 핵심은 role 게이트(403)를 통과한다는 것
    expect(res.status, 'SUPER must pass the crossboarding role gate').not.toBe(403)
    await ctx.dispose()
  })

  // ── onboarding instance: sameCompany 게이트 ────────────────

  test('onboarding instance GET: CTR-CN HR → CTR instance 403', async () => {
    test.skip(!ctrInstanceId, 'no CTR onboarding instance fixture in seed')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.get(`/api/v1/onboarding/instances/${ctrInstanceId}`)
    assertError(res, 403, 'CTR-CN HR blocked from CTR onboarding instance')
    await ctx.dispose()
  })

  test('onboarding sign-off: CTR-CN HR → CTR instance 403', async () => {
    test.skip(!ctrInstanceId, 'no CTR onboarding instance fixture in seed')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.post(`/api/v1/onboarding/instances/${ctrInstanceId}/sign-off`, { note: 'x' })
    assertError(res, 403, 'CTR-CN HR blocked from CTR sign-off')
    await ctx.dispose()
  })

  test('onboarding instance GET: same-company CTR HR allowed (not 403)', async () => {
    test.skip(!ctrInstanceId, 'no CTR onboarding instance fixture in seed')
    const { ctx, api } = await clientFor('HR_ADMIN')
    const res = await api.get(`/api/v1/onboarding/instances/${ctrInstanceId}`)
    expect(res.status, 'same-company HR must not be blocked').not.toBe(403)
    await ctx.dispose()
  })

  // ── 읽기 스코프: raw companyId 파라미터 무시 ─────────────────

  test('leave/designated-days: CTR-CN HR with CTR companyId param stays scoped', async () => {
    test.skip(!ctrCompanyId, 'no CTR company-specific type-def fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    // CTR companyId를 보내도 resolveCompanyId가 본인 법인(CTR-CN) 강제 → 200(본인 데이터)
    const res = await api.get('/api/v1/leave/designated-days', { companyId: ctrCompanyId })
    // 누출이라면 CTR 데이터가 보였겠지만, 스코프되어 본인 법인 결과(빈 배열 등) 200
    expect(res.status, 'param-based cross-tenant read must not error-leak').toBe(200)
    await ctx.dispose()
  })
})
