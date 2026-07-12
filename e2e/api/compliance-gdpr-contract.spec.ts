// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GDPR retention/consent API 계약 e2e
// 런칭 감사 P1 수정 검증: FE 가 mock 계약(가짜 경로·snake_case·자유 문자열
// enum)으로 작성돼 있던 것을 실제 백엔드 계약으로 정렬 + DELETE 라우트 신설.
// ═══════════════════════════════════════════════════════════

import { test, expect, request as pwRequest } from '@playwright/test'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'

const RETENTION = '/api/v1/compliance/gdpr/retention'
const CONSENTS = '/api/v1/compliance/gdpr/consents'

const ALL_CATEGORIES = [
  'EMPLOYMENT_RECORDS', 'PAYROLL_DATA', 'PERFORMANCE_DATA', 'TRAINING_RECORDS',
  'RECRUITMENT_DATA', 'HEALTH_SAFETY', 'DISCIPLINARY_RECORDS', 'LEAVE_RECORDS', 'AUDIT_LOGS',
]

test.describe('GDPR Retention Policy CRUD: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })
  test.describe.configure({ mode: 'serial' })

  let policyId = ''
  let selectedCategory = ''

  test('create — @@unique(companyId,category) 회피 위해 빈 카테고리 동적 선택', async ({ request }) => {
    const api = new ApiClient(request)
    const listRes = await api.get(RETENTION, { page: '1', limit: '50' })
    assertOk(listRes, 'list policies')
    const rows = (listRes.data as { id: string; category: string }[]) ?? []
    const used = new Set(rows.map((p) => p.category))
    const free = ALL_CATEGORIES.find((c) => !used.has(c))
    let category = free
    if (!category) {
      // 전 카테고리 선점 → 기존 행 하나 삭제해 자리 확보하고 "그 카테고리"로 생성
      const victim = rows[0]
      const del = await api.del(`${RETENTION}/${victim.id}`)
      assertOk(del, 'free a category slot')
      category = victim.category
    }
    selectedCategory = category
    const res = await api.post(RETENTION, {
      category,
      retentionMonths: 36,
      description: 'e2e contract test',
      autoDelete: false,
      anonymize: true,
    })
    assertOk(res, 'create policy (camelCase + enum)')
    policyId = (res.data as { id: string }).id
    expect(policyId).toBeTruthy()
  })

  test('update — PUT (PATCH 아님)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await api.put(`${RETENTION}/${policyId}`, { retentionMonths: 60 })
    assertOk(res, 'update policy via PUT')
    expect((res.data as { retentionMonths: number }).retentionMonths).toBe(60)
  })

  test('run — POST /retention/run body {policyId}', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await api.post(`${RETENTION}/run`, { policyId })
    assertOk(res, 'run policy')
  })

  test('EMPLOYEE 는 DELETE 403 (destructive negative auth)', async () => {
    const empCtx = await pwRequest.newContext({ storageState: authFile('EMPLOYEE') })
    const empApi = new ApiClient(empCtx)
    const res = await empApi.del(`${RETENTION}/${policyId}`)
    await empCtx.dispose()
    assertError(res, 403, 'employee cannot delete retention policy')
  })

  test('delete — DELETE /retention/{id} (신설 라우트) + 같은 카테고리 재생성 가능', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await api.del(`${RETENTION}/${policyId}`)
    assertOk(res, 'delete policy')
    const list = await api.get(RETENTION, { page: '1', limit: '50' })
    const ids = ((list.data as { id: string }[]) ?? []).map((p) => p.id)
    expect(ids).not.toContain(policyId)
    // hard delete 라 unique trap 없음 — 같은 카테고리 즉시 재생성 201
    const recreate = await api.post(RETENTION, {
      category: selectedCategory,
      retentionMonths: 24,
      autoDelete: false,
      anonymize: true,
    })
    assertOk(recreate, 'same-category recreate after hard delete')
    // cleanup — 재생성분 제거
    const cleanup = await api.del(`${RETENTION}/${(recreate.data as { id: string }).id}`)
    assertOk(cleanup, 'cleanup recreated policy')
  })
})

test.describe('GDPR Consent lifecycle: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })
  test.describe.configure({ mode: 'serial' })

  let consentId = ''

  test('create — camelCase + purpose enum + ISO expiresAt', async ({ request }) => {
    const api = new ApiClient(request)
    const empRes = await api.get('/api/v1/employees', { page: '1', limit: '1' })
    const employeeId = ((empRes.data as { id: string }[]) ?? [])[0]?.id
    expect(employeeId, 'resolve an employee').toBeTruthy()
    const res = await api.post(CONSENTS, {
      employeeId,
      purpose: 'MARKETING_COMMUNICATION',
      legalBasis: 'e2e consent — Art. 6(1)(a)',
      expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
    })
    assertOk(res, 'create consent')
    consentId = (res.data as { id: string }).id
    expect((res.data as { status: string }).status).toBe('ACTIVE')
  })

  test('revoke — POST /consents/{id}/revoke (no body)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await api.post(`${CONSENTS}/${consentId}/revoke`)
    assertOk(res, 'revoke consent')
    expect((res.data as { status: string }).status).toBe('REVOKED')
  })

  test('re-revoke → 400 (already revoked)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await api.post(`${CONSENTS}/${consentId}/revoke`)
    assertError(res, 400, 'double revoke rejected')
  })

  test('타 법인 직원 employeeId 로 생성 → 400 (cross-tenant 차단)', async ({ request }) => {
    const cnCtx = await pwRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const cnApi = new ApiClient(cnCtx)
    const cnEmps = await cnApi.get('/api/v1/employees', { page: '1', limit: '1' })
    const cnEmployeeId = ((cnEmps.data as { id: string }[]) ?? [])[0]?.id
    await cnCtx.dispose()
    test.skip(!cnEmployeeId, 'no CTR-CN employee seeded')

    const api = new ApiClient(request)
    const res = await api.post(CONSENTS, {
      employeeId: cnEmployeeId,
      purpose: 'MARKETING_COMMUNICATION',
      legalBasis: 'cross-tenant probe',
    })
    assertError(res, 400, 'cross-company consent create rejected')
  })
})
