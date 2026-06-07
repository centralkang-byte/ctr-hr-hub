// ═══════════════════════════════════════════════════════════
// 기타(misc) 멀티테넌트 격리 — cross-tenant 차단 회귀 방지
// (multi-tenant-leak-hunt remediation batch6 / Codex G1+G2 가드)
//
// 시나리오 (CTR-CN HR → CTR 리소스 차단 + 회귀):
//   P2 읽기 스코프: directory/departments/job-grades/grade-title-mappings —
//     CTR companyId 파라미터를 보내도 본인 법인(CTR-CN)으로 강제(타 법인 데이터 0)
//   P2 SUPER carve-out: SUPER는 companyId 파라미터로 CTR 데이터 조회 가능(전체뷰 보존)
//   P3 RC-A: severance/peer-review — CTR employeeId로 타 법인 PII 조회 → 404
//   P4 entity-transfers: execute(출발법인 가드)·create(source 소유) → 404/403
//   P1d/P1rel: documents/certificate/work-hour-alerts/benefit-claims — 타 법인 by-id → 404/403
// ═══════════════════════════════════════════════════════════

import { test, expect, request as playwrightRequest } from '@playwright/test'
import { ApiClient, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import type { RoleType } from '../helpers/auth'

async function clientFor(role: RoleType) {
  const ctx = await playwrightRequest.newContext({ storageState: authFile(role) })
  return { ctx, api: new ApiClient(ctx) }
}

// 다양한 응답 셰입(apiSuccess(array) | apiPaginated | {alerts}|{items})에서 첫 id 추출
function firstId(data: unknown): string {
  if (Array.isArray(data)) return (data[0] as { id?: string })?.id ?? ''
  const d = data as {
    data?: Array<{ id?: string }>
    items?: Array<{ id?: string }>
    alerts?: Array<{ id?: string }>
  }
  return d?.data?.[0]?.id ?? d?.items?.[0]?.id ?? d?.alerts?.[0]?.id ?? ''
}

function asArray<T = Record<string, unknown>>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  const d = data as { data?: T[]; items?: T[] }
  return d?.data ?? d?.items ?? []
}

const BOGUS_UUID = '00000000-0000-0000-0000-000000000000'

test.describe('misc (기타) cross-tenant isolation', () => {
  test.describe.configure({ mode: 'serial' })

  let ctrCompanyId = ''
  let ctrEmployeeId = ''
  let ctrDocId = ''
  let ctrAlertId = ''
  let ctrClaimId = ''
  let ctrCertReqId = ''
  let ctrTransferId = ''

  test.beforeAll(async () => {
    // ── CTR(국내) HR로 CTR 픽스처 확보 ──
    const { ctx, api } = await clientFor('HR_ADMIN')

    const jg = await api.get('/api/v1/job-grades')
    ctrCompanyId =
      asArray<{ companyId?: string }>(jg.data).find((g) => g.companyId)?.companyId ?? ''

    const dir = await api.get('/api/v1/directory')
    const emps = asArray<{ id?: string }>(dir.data)
    ctrEmployeeId = emps[0]?.id ?? ''

    if (ctrEmployeeId) {
      const docs = await api.get(`/api/v1/employees/${ctrEmployeeId}/documents`)
      ctrDocId = firstId(docs.data)
      const certs = await api.get(`/api/v1/employees/${ctrEmployeeId}/certificate-requests`)
      ctrCertReqId =
        asArray<{ id?: string; status?: string }>(certs.data).find(
          (c) => c.status === 'REQUESTED',
        )?.id ?? ''
    }

    const alerts = await api.get('/api/v1/attendance/work-hour-alerts')
    ctrAlertId = firstId(alerts.data)

    const claims = await api.get('/api/v1/benefit-claims')
    ctrClaimId = firstId(claims.data)

    const transfers = await api.get('/api/v1/entity-transfers', { status: 'EXEC_APPROVED' })
    ctrTransferId = firstId(transfers.data)

    await ctx.dispose()
  })

  // ── P2 읽기 스코프: companyId 파라미터 무력화 ──────────────

  test('departments: CTR-CN HR with CTR companyId param → no CTR data', async () => {
    test.skip(!ctrCompanyId, 'no CTR companyId fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.get('/api/v1/departments', { companyId: ctrCompanyId })
    expect(res.status, 'scoped read must not error-leak').toBe(200)
    const leaked = asArray<{ companyId?: string }>(res.data).filter(
      (d) => d.companyId === ctrCompanyId,
    )
    expect(leaked.length, 'CTR departments must not leak to CTR-CN HR').toBe(0)
    await ctx.dispose()
  })

  test('job-grades: CTR-CN HR with CTR companyId param → no CTR data', async () => {
    test.skip(!ctrCompanyId, 'no CTR companyId fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.get('/api/v1/job-grades', { companyId: ctrCompanyId })
    expect(res.status).toBe(200)
    const leaked = asArray<{ companyId?: string }>(res.data).filter(
      (g) => g.companyId === ctrCompanyId,
    )
    expect(leaked.length, 'CTR job grades must not leak to CTR-CN HR').toBe(0)
    await ctx.dispose()
  })

  test('grade-title-mappings: CTR-CN HR with CTR companyId param → no CTR data', async () => {
    test.skip(!ctrCompanyId, 'no CTR companyId fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.get('/api/v1/grade-title-mappings', { companyId: ctrCompanyId })
    expect(res.status).toBe(200)
    const leaked = asArray<{ companyId?: string }>(res.data).filter(
      (m) => m.companyId === ctrCompanyId,
    )
    expect(leaked.length, 'CTR grade-title mappings must not leak').toBe(0)
    await ctx.dispose()
  })

  test('directory: CTR-CN HR with CTR companyId param → no CTR employees', async () => {
    test.skip(!ctrCompanyId, 'no CTR companyId fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.get('/api/v1/directory', { companyId: ctrCompanyId })
    expect(res.status).toBe(200)
    const leaked = asArray<{ company?: { id?: string } }>(res.data).filter(
      (e) => e.company?.id === ctrCompanyId,
    )
    expect(leaked.length, 'CTR employees must not leak to CTR-CN HR directory').toBe(0)
    await ctx.dispose()
  })

  // ── P2 SUPER carve-out: 전체뷰 보존 ────────────────────────

  test('departments: SUPER with CTR companyId param → CTR data visible', async () => {
    test.skip(!ctrCompanyId, 'no CTR companyId fixture')
    const { ctx, api } = await clientFor('SUPER_ADMIN')
    const res = await api.get('/api/v1/departments', { companyId: ctrCompanyId })
    expect(res.status).toBe(200)
    const ctrDepts = asArray<{ companyId?: string }>(res.data).filter(
      (d) => d.companyId === ctrCompanyId,
    )
    expect(ctrDepts.length, 'SUPER must still target a specific company').toBeGreaterThan(0)
    await ctx.dispose()
  })

  // ── P3 RC-A: severance / peer-review ──────────────────────

  test('severance: CTR-CN HR → CTR employee → 404', async () => {
    test.skip(!ctrEmployeeId, 'no CTR employee fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.get('/api/v1/compliance/kr/severance-interim/calculate', {
      employeeId: ctrEmployeeId,
    })
    assertError(res, 404, 'CTR-CN HR blocked from CTR employee severance')
    await ctx.dispose()
  })

  test('severance: same-company CTR HR → CTR employee not 404 (regression)', async () => {
    test.skip(!ctrEmployeeId, 'no CTR employee fixture')
    const { ctx, api } = await clientFor('HR_ADMIN')
    const res = await api.get('/api/v1/compliance/kr/severance-interim/calculate', {
      employeeId: ctrEmployeeId,
    })
    expect(res.status, 'same-company severance must not be blocked').not.toBe(404)
    await ctx.dispose()
  })

  test('peer-review candidates: CTR-CN HR → CTR employee → 404', async () => {
    test.skip(!ctrEmployeeId, 'no CTR employee fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.get('/api/v1/performance/peer-review/candidates', {
      employeeId: ctrEmployeeId,
      cycleId: BOGUS_UUID,
    })
    assertError(res, 404, 'CTR-CN HR blocked from CTR peer-review candidates')
    await ctx.dispose()
  })

  // ── P4 entity-transfers ───────────────────────────────────

  test('entity-transfers create: CTR-CN HR → CTR employee → 403', async () => {
    test.skip(!ctrEmployeeId, 'no CTR employee fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.post('/api/v1/entity-transfers', {
      employeeId: ctrEmployeeId,
      toCompanyId: BOGUS_UUID,
      transferType: 'PERMANENT_TRANSFER',
      transferDate: '2026-09-01',
    })
    assertError(res, 403, 'CTR-CN HR cannot initiate transfer for CTR employee')
    await ctx.dispose()
  })

  test('entity-transfers execute: CTR-CN HR → CTR transfer → 404', async () => {
    test.skip(!ctrTransferId, 'no EXEC_APPROVED CTR transfer fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.put(`/api/v1/entity-transfers/${ctrTransferId}/execute`)
    assertError(res, 404, 'CTR-CN HR (not fromCompany) blocked from CTR transfer execute')
    await ctx.dispose()
  })

  // ── P1d / P1rel: by-id 리소스 ─────────────────────────────

  test('document download: CTR-CN HR → CTR employee doc → 404', async () => {
    test.skip(!ctrEmployeeId || !ctrDocId, 'no CTR document fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.get(
      `/api/v1/employees/${ctrEmployeeId}/documents/${ctrDocId}/download`,
    )
    assertError(res, 404, 'CTR-CN HR blocked from CTR document download')
    await ctx.dispose()
  })

  test('certificate approve: CTR-CN HR → CTR request → 404', async () => {
    test.skip(!ctrEmployeeId || !ctrCertReqId, 'no CTR REQUESTED certificate fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.post(
      `/api/v1/employees/${ctrEmployeeId}/certificate-requests/${ctrCertReqId}/approve`,
      {},
    )
    assertError(res, 404, 'CTR-CN HR blocked from approving CTR certificate request')
    await ctx.dispose()
  })

  test('work-hour-alert resolve: CTR-CN HR → CTR alert → 404', async () => {
    test.skip(!ctrAlertId, 'no CTR work-hour-alert fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.patch(`/api/v1/attendance/work-hour-alerts/${ctrAlertId}`, {
      resolveNote: 'x',
    })
    assertError(res, 404, 'CTR-CN HR blocked from resolving CTR work-hour alert')
    await ctx.dispose()
  })

  test('benefit-claim detail: CTR-CN HR → CTR claim → 403', async () => {
    test.skip(!ctrClaimId, 'no CTR benefit-claim fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.get(`/api/v1/benefit-claims/${ctrClaimId}`)
    assertError(res, 403, 'CTR-CN HR blocked from CTR benefit claim')
    await ctx.dispose()
  })

  test('documents list: CTR-CN HR → CTR employee → 404 (employee scope)', async () => {
    test.skip(!ctrEmployeeId, 'no CTR employee fixture')
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.get(`/api/v1/employees/${ctrEmployeeId}/documents`)
    assertError(res, 404, 'CTR-CN HR blocked from CTR employee document list')
    await ctx.dispose()
  })
})
