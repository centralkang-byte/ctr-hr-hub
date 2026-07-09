// ═══════════════════════════════════════════════════════════
// Settings Hub — 변경 이력(audit-log 확장) + 설정 백업(export) (Wave 1)
// - audit-log: HR 자사+global 행, 타법인 누출 X, global 행 actor/changes 마스킹
// - export: HR 자사 스코프(param 무시), EMPLOYEE 403
// ═══════════════════════════════════════════════════════════

import { test, expect, request as playwrightRequest } from '@playwright/test'
import { ApiClient } from '../helpers/api-client'
import { authFile } from '../helpers/auth'

interface AuditEntry {
  companyId: string | null
  actor: { name: string } | null
  changes: unknown
  company: { code: string } | null
}

let ctrCompanyId = ''

test.beforeAll(async () => {
  const r = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
  const res = await new ApiClient(r).get('/api/v1/companies')
  const companies = (res.data as Array<{ id: string; code: string }> | undefined) ?? []
  ctrCompanyId = companies.find((c) => c.code === 'CTR')?.id ?? ''
  await r.dispose()
})

test.describe('settings-audit-log', () => {
  test('HR_ADMIN: 200, no foreign-company rows, global rows masked', async () => {
    const r = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await new ApiClient(r).get(`/api/v1/settings-audit-log?limit=50&companyId=${ctrCompanyId}`)
    expect(res.status).toBe(200)
    const logs = ((res.data as { logs?: AuditEntry[] })?.logs) ?? []
    // 타법인(CTR) 행 없음 — companyId 파라미터는 비-SUPER에게 무시됨
    expect(logs.filter((l) => l.companyId === ctrCompanyId).length).toBe(0)
    // global(null) 행은 actor·changes 마스킹
    for (const l of logs.filter((x) => x.companyId === null)) {
      expect(l.actor).toBeNull()
      expect(l.changes).toBeNull()
    }
    await r.dispose()
  })

  test('EMPLOYEE: 403', async () => {
    const r = await playwrightRequest.newContext({ storageState: authFile('EMPLOYEE') })
    const res = await new ApiClient(r).get('/api/v1/settings-audit-log')
    expect(res.status).toBe(403)
    await r.dispose()
  })
})

test.describe('settings/export', () => {
  test('HR_ADMIN: 200 with own-company scope even if foreign companyId param', async () => {
    const r = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const res = await new ApiClient(r).get(`/api/v1/settings/export?companyId=${ctrCompanyId}`)
    expect(res.status).toBe(200)
    const data = res.data as { companyCode?: string | null; jobGrades?: unknown[] } | undefined
    // 비-SUPER는 파라미터 무시 → 자사(CTR-CN) 백업
    expect(data?.companyCode).toBe('CTR-CN')
    expect(Array.isArray(data?.jobGrades)).toBe(true)
    await r.dispose()
  })

  test('SUPER_ADMIN: companyId param selects target company', async () => {
    expect(ctrCompanyId, 'CTR companyId fixture').toBeTruthy()
    const r = await playwrightRequest.newContext({ storageState: authFile('SUPER_ADMIN') })
    const res = await new ApiClient(r).get(`/api/v1/settings/export?companyId=${ctrCompanyId}`)
    expect(res.status).toBe(200)
    expect((res.data as { companyCode?: string })?.companyCode).toBe('CTR')
    await r.dispose()
  })

  test('EMPLOYEE: 403', async () => {
    const r = await playwrightRequest.newContext({ storageState: authFile('EMPLOYEE') })
    const res = await new ApiClient(r).get('/api/v1/settings/export')
    expect(res.status).toBe(403)
    await r.dispose()
  })
})
