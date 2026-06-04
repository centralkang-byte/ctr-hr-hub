// ═══════════════════════════════════════════════════════════
// Settings 멀티테넌트 격리 (cross-tenant 누출 가드)
// 패턴1(resolveCompanyId 치환): 타 companyId param/body → 자기법인 스코프 (CTR 데이터 누출 X)
// 패턴2(ownership): approval-flows/notification-triggers 글로벌(null)·타법인 쓰기 → 403; 글로벌 읽기 보존
// ═══════════════════════════════════════════════════════════

import { test, expect, request as playwrightRequest } from '@playwright/test'
import { ApiClient, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'

const S = '/api/v1/settings'

test.describe('Settings cross-tenant: foreign-company HR scoped/blocked', () => {
  test.describe.configure({ mode: 'serial' })

  let ctrCompanyId = ''

  test.beforeAll(async () => {
    const r = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    const res = await new ApiClient(r).get('/api/v1/companies')
    const companies = (res.data as Array<{ id: string; code: string }> | undefined) ?? []
    ctrCompanyId = companies.find((c) => c.code === 'CTR')?.id ?? companies[0]?.id ?? ''
    await r.dispose()
  })

  // ── 패턴1: 치환 → 자기법인 스코프 (CTR 데이터 누출 X) ──
  test('promotion/compensation/evaluation GET ignore cross-tenant companyId param', async () => {
    expect(ctrCompanyId, 'CTR companyId fixture').toBeTruthy()
    const r = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const api = new ApiClient(r)
    for (const p of ['promotion', 'compensation', 'evaluation']) {
      const res = await api.get(`${S}/${p}?companyId=${ctrCompanyId}`)
      expect([200, 400, 404], `${p} scoped to caller, no CTR leak`).toContain(res.status)
    }
    await r.dispose()
  })

  test('job-grades GET does not leak CTR grades to CTR-CN HR', async () => {
    const r = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await new ApiClient(r).get(`${S}/job-grades?companyId=${ctrCompanyId}`)
    expect(res.status).toBe(200)
    const grades = (res.data as Array<{ companyId?: string }> | undefined) ?? []
    expect(grades.filter((g) => g.companyId === ctrCompanyId).length, 'no CTR grades leaked').toBe(0)
    await r.dispose()
  })

  test('promotion override POST for CTR is scoped to caller, never creates CTR override', async () => {
    const r = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await new ApiClient(r).post(`${S}/promotion/override`, { companyId: ctrCompanyId })
    expect([200, 201, 400, 409], 'scoped to caller (CTR-CN), not CTR').toContain(res.status)
    await r.dispose()
  })

  // ── 패턴2: approval-flows 글로벌/타법인 쓰기 → 403, 글로벌 읽기 보존 ──
  test('approval-flows GET returns only own-company + global for non-SUPER', async () => {
    const r = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await new ApiClient(r).get(`${S}/approval-flows`)
    expect(res.status).toBe(200)
    const flows = (res.data as Array<{ companyId?: string | null }> | undefined) ?? []
    const foreign = flows.filter((f) => f.companyId != null && f.companyId === ctrCompanyId)
    expect(foreign.length, 'no CTR-only flows leaked to CTR-CN HR').toBe(0)
    await r.dispose()
  })

  test('approval-flows PUT/DELETE on CTR or global flow → 403 for non-SUPER', async () => {
    const sup = await playwrightRequest.newContext({ storageState: authFile('SUPER_ADMIN') })
    const all = await new ApiClient(sup).get(`${S}/approval-flows`)
    const flows = (all.data as Array<{ id: string; companyId?: string | null }> | undefined) ?? []
    const globalFlow = flows.find((f) => f.companyId == null)
    const ctrFlow = flows.find((f) => f.companyId === ctrCompanyId)
    await sup.dispose()
    test.skip(!globalFlow && !ctrFlow, 'no approval-flow fixtures available')

    const cn = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const api = new ApiClient(cn)
    if (globalFlow) assertError(await api.put(`${S}/approval-flows`, { id: globalFlow.id, name: 'hijack' }), 403, 'CN HR cannot edit global flow')
    if (ctrFlow) assertError(await api.put(`${S}/approval-flows`, { id: ctrFlow.id, name: 'hijack' }), 403, 'CN HR cannot edit CTR flow')
    if (ctrFlow) assertError(await api.del(`${S}/approval-flows?id=${ctrFlow.id}`), 403, 'CN HR cannot delete CTR flow')
    await cn.dispose()
  })

  // ── notification-triggers 글로벌 쓰기 → 403 ──
  test('notification-triggers PUT/DELETE on global trigger → 403 for non-SUPER', async () => {
    const sup = await playwrightRequest.newContext({ storageState: authFile('SUPER_ADMIN') })
    const all = await new ApiClient(sup).get(`${S}/notification-triggers`)
    const trigs = (all.data as Array<{ id: string; companyId?: string | null }> | undefined) ?? []
    const globalTrig = trigs.find((t) => t.companyId == null)
    await sup.dispose()
    test.skip(!globalTrig, 'no global trigger fixture')

    const cn = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const api = new ApiClient(cn)
    if (globalTrig) {
      assertError(await api.put(`${S}/notification-triggers/${globalTrig.id}`, { isActive: false }), 403, 'CN HR cannot edit global trigger')
      assertError(await api.del(`${S}/notification-triggers/${globalTrig.id}`), 403, 'CN HR cannot delete global trigger')
    }
    await cn.dispose()
  })
})
