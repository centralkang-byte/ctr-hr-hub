// ═══════════════════════════════════════════════════════════
// 멀티테넌트 잔여 cross-tenant 격리 — 트랙 확정 종료 (batch7)
// (multi-tenant-leak-hunt 잔여 11 누출 — 버킷 경계 밖 + lint 발견분)
//
// 시나리오 (CTR-CN HR → CTR 리소스 차단 + SUPER carve-out + 회귀):
//   읽기 스코프(#11·#2·#7·#5·#3·#1): CTR companyId 파라미터를 보내도 본인 법인 강제 → CTR 데이터 0
//   쓰기 강제(#8·#6): companyId=CTR로 생성해도 본인 법인(CTR-CN)으로 강제
//   by-id(#10): CTR 시나리오 id → 404 / 삭제 404
//   PII(#9): CTR employeeId comp 추천 → 404
//   SUPER carve-out: SUPER는 companyId 파라미터로 CTR 조회 가능
//   회귀: same-company는 정상
//   ※ #4(scenarios POST) = 코드 fix + #3/#10 스코프로 커버(스키마 의존 e2e 생략)
// ═══════════════════════════════════════════════════════════

import { test, expect, request as playwrightRequest } from '@playwright/test'
import { ApiClient, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import type { RoleType } from '../helpers/auth'

async function clientFor(role: RoleType) {
  const ctx = await playwrightRequest.newContext({ storageState: authFile(role) })
  return { ctx, api: new ApiClient(ctx) }
}

function asArray<T = Record<string, unknown>>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  const d = data as { data?: T[]; items?: T[] }
  return d?.data ?? d?.items ?? []
}

function firstId(data: unknown): string {
  if (Array.isArray(data)) return (data[0] as { id?: string })?.id ?? ''
  const d = data as { data?: Array<{ id?: string }>; items?: Array<{ id?: string }> }
  return d?.data?.[0]?.id ?? d?.items?.[0]?.id ?? ''
}

const BOGUS_UUID = '00000000-0000-0000-0000-000000000000'

test.describe('residual cross-tenant isolation (batch7)', () => {
  test.describe.configure({ mode: 'serial' })

  let ctrCompanyId = ''
  let ctrEmployeeId = ''
  let ctrScenarioId = ''

  test.beforeAll(async () => {
    // CTR(국내) HR로 CTR 픽스처 확보
    const { ctx, api } = await clientFor('HR_ADMIN')

    const jg = await api.get('/api/v1/job-grades')
    ctrCompanyId =
      asArray<{ companyId?: string }>(jg.data).find((g) => g.companyId)?.companyId ?? ''

    const dir = await api.get('/api/v1/directory')
    ctrEmployeeId = asArray<{ id?: string }>(dir.data)[0]?.id ?? ''

    const scen = await api.get('/api/v1/payroll/simulation/scenarios')
    ctrScenarioId = firstId(scen.data)

    await ctx.dispose()
  })

  // ── 읽기 스코프: companyId 파라미터 무력화 ──────────────

  test('#11 leave-of-absence list: CTR-CN HR ?companyId=CTR → no CTR records', async () => {
    test.skip(!ctrCompanyId, 'no CTR companyId fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.get('/api/v1/leave-of-absence', { companyId: ctrCompanyId })
    expect(res.status, 'scoped read must not error-leak').toBe(200)
    const leaked = asArray<{ companyId?: string }>(res.data).filter(
      (r) => r.companyId === ctrCompanyId,
    )
    expect(leaked.length, 'CTR leave-of-absence must not leak to CTR-CN HR').toBe(0)
    await ctx.dispose()
  })

  test('#2 leave-of-absence/types: CTR-CN HR ?companyId=CTR → no CTR types', async () => {
    test.skip(!ctrCompanyId, 'no CTR companyId fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.get('/api/v1/leave-of-absence/types', { companyId: ctrCompanyId })
    expect(res.status).toBe(200)
    const leaked = asArray<{ companyId?: string }>(res.data).filter(
      (t) => t.companyId === ctrCompanyId,
    )
    expect(leaked.length, 'CTR leave-of-absence types must not leak').toBe(0)
    await ctx.dispose()
  })

  test('#7 skills/matrix: CTR-CN HR ?companyId=CTR → no CTR employee', async () => {
    test.skip(!ctrCompanyId || !ctrEmployeeId, 'no CTR fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.get('/api/v1/skills/matrix', { companyId: ctrCompanyId })
    expect(res.status).toBe(200)
    expect(
      JSON.stringify(res.data ?? {}),
      'CTR employee must not appear in CTR-CN HR skill matrix',
    ).not.toContain(ctrEmployeeId)
    await ctx.dispose()
  })

  test('#5 skills/gap-report: CTR-CN HR ?companyId=CTR → no CTR employee', async () => {
    test.skip(!ctrCompanyId || !ctrEmployeeId, 'no CTR fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.get('/api/v1/skills/gap-report', { companyId: ctrCompanyId })
    expect(res.status).toBe(200)
    expect(
      JSON.stringify(res.data ?? {}),
      'CTR employee must not appear in CTR-CN HR gap report',
    ).not.toContain(ctrEmployeeId)
    await ctx.dispose()
  })

  test('#3 scenarios list: CTR-CN HR ?companyId=CTR → no CTR scenarios', async () => {
    test.skip(!ctrCompanyId, 'no CTR companyId fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.get('/api/v1/payroll/simulation/scenarios', { companyId: ctrCompanyId })
    expect(res.status).toBe(200)
    const leaked = asArray<{ companyId?: string }>(res.data).filter(
      (s) => s.companyId === ctrCompanyId,
    )
    expect(leaked.length, 'CTR simulation scenarios must not leak').toBe(0)
    await ctx.dispose()
  })

  test('#1 dashboard/summary: CTR-CN HR ?companyId=CTR → not CTR; ?companyId=all → not all', async () => {
    test.skip(!ctrCompanyId, 'no CTR companyId fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')

    const targeted = await api.get('/api/v1/dashboard/summary', { companyId: ctrCompanyId })
    expect(targeted.status).toBe(200)
    const meta1 = (targeted.data as { meta?: { companyId?: string | null } })?.meta
    expect(meta1?.companyId, 'CTR-CN HR must not resolve to CTR').not.toBe(ctrCompanyId)

    const all = await api.get('/api/v1/dashboard/summary', { companyId: 'all' })
    expect(all.status).toBe(200)
    const meta2 = (all.data as { meta?: { companyId?: string | null } })?.meta
    expect(meta2?.companyId, 'non-global HR must not get all-company (null) view').not.toBeNull()
    expect(meta2?.companyId).not.toBe(ctrCompanyId)

    await ctx.dispose()
  })

  // ── 쓰기 강제: companyId=CTR → 본인 법인(CTR-CN) ───────────

  test('#8 positions POST: CTR-CN HR companyId=CTR → created NOT as CTR', async () => {
    test.skip(!ctrCompanyId, 'no CTR companyId fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.post('/api/v1/positions', {
      titleKo: 'XT 격리 테스트',
      code: `XT-POS-${Date.now()}`,
      companyId: ctrCompanyId, // 타 법인 주입 시도
    })
    expect([200, 201]).toContain(res.status)
    const created = res.data as { companyId?: string }
    expect(created.companyId, 'position must be forced to caller company, not CTR').not.toBe(
      ctrCompanyId,
    )
    await ctx.dispose()
  })

  test('#6 skills/gap-report POST: CTR-CN HR companyId=CTR → created NOT as CTR', async () => {
    test.skip(!ctrCompanyId, 'no CTR companyId fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.post('/api/v1/skills/gap-report', {
      assessmentPeriod: `XT-${Date.now()}`,
      reportData: { test: true },
      companyId: ctrCompanyId, // 타 법인 주입 시도
    })
    expect([200, 201]).toContain(res.status)
    const created = res.data as { companyId?: string }
    expect(created.companyId, 'gap report must be forced to caller company, not CTR').not.toBe(
      ctrCompanyId,
    )
    await ctx.dispose()
  })

  // ── by-id(#10) + PII(#9) ──────────────────────────────────

  test('#10 scenario detail: CTR-CN HR → CTR scenario id → 404', async () => {
    test.skip(!ctrScenarioId, 'no CTR scenario fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.get(`/api/v1/payroll/simulation/scenarios/${ctrScenarioId}`)
    assertError(res, 404, 'CTR-CN HR blocked from CTR scenario detail')
    await ctx.dispose()
  })

  test('#10 scenario delete: CTR-CN HR → CTR scenario id → 404', async () => {
    test.skip(!ctrScenarioId, 'no CTR scenario fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.del(`/api/v1/payroll/simulation/scenarios/${ctrScenarioId}`)
    assertError(res, 404, 'CTR-CN HR blocked from deleting CTR scenario')
    await ctx.dispose()
  })

  test('#9 comp ai-recommend: CTR-CN HR → CTR employee → 404', async () => {
    test.skip(!ctrEmployeeId, 'no CTR employee fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.post('/api/v1/compensation/simulation/ai-recommend', {
      cycleId: BOGUS_UUID,
      employeeId: ctrEmployeeId, // CTR 직원 PII 조회 시도
      budgetConstraint: 0,
      companyAvgRaise: 0,
    })
    assertError(res, 404, 'CTR-CN HR blocked from CTR employee comp recommendation')
    await ctx.dispose()
  })

  // ── SUPER carve-out + 회귀 ─────────────────────────────────

  test('SUPER carve-out: dashboard/summary ?companyId=CTR → CTR scoped', async () => {
    test.skip(!ctrCompanyId, 'no CTR companyId fixture')
    const { ctx, api } = await clientFor('SUPER_ADMIN')
    const res = await api.get('/api/v1/dashboard/summary', { companyId: ctrCompanyId })
    expect(res.status).toBe(200)
    const meta = (res.data as { meta?: { companyId?: string | null } })?.meta
    expect(meta?.companyId, 'SUPER must still target a specific company').toBe(ctrCompanyId)
    await ctx.dispose()
  })

  test('regression: CTR HR dashboard/summary → own (CTR) data', async () => {
    test.skip(!ctrCompanyId, 'no CTR companyId fixture')
    const { ctx, api } = await clientFor('HR_ADMIN')
    const res = await api.get('/api/v1/dashboard/summary')
    expect(res.status).toBe(200)
    const meta = (res.data as { meta?: { companyId?: string | null } })?.meta
    expect(meta?.companyId, 'CTR HR must see own company').toBe(ctrCompanyId)
    await ctx.dispose()
  })
})
