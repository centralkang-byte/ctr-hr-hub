// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee insights/recognition 전사조회 + 멀티테넌트 격리 API
// CEO 지시: SUPER_ADMIN은 타 법인 직원 성과/인정도 조회(전사). 비-SUPER는 자기 법인만.
// 대상 엔드포인트(resolveCompanyFilter SSOT 적용):
//   GET /api/v1/employees/[id]/insights
//   GET /api/v1/cfr/recognitions/employee/[id]
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile } from '../helpers/auth'
import { parseApiResponse, assertOk } from '../helpers/api-client'
import { resolveSeedData } from '../helpers/test-data'

test.describe('Employee insights/recognition — SUPER 전사조회 + 비-SUPER 격리', () => {
  test.use({ storageState: authFile('SUPER_ADMIN') })

  // 이민준(CTR) — SUPER(CTR-HOLD)에게는 타 법인 직원
  let employeeId: string
  test.beforeAll(async ({ request }) => {
    const seed = await resolveSeedData(request)
    employeeId = seed.employeeId
  })

  test('SUPER: 타 법인 직원 insights = 200 (전사조회)', async ({ request }) => {
    const res = await request.get(`/api/v1/employees/${employeeId}/insights`)
    const result = await parseApiResponse<{ goals: unknown[]; employee: { id: string } }>(res)
    assertOk(result, 'SUPER insights cross-company')
    expect(result.data).toHaveProperty('goals')
    expect(result.data).toHaveProperty('employee')
  })

  test('SUPER: 타 법인 직원 recognitions = 200 (전사조회)', async ({ request }) => {
    const res = await request.get(`/api/v1/cfr/recognitions/employee/${employeeId}`)
    const result = await parseApiResponse<{ receivedCount: number }>(res)
    assertOk(result, 'SUPER recognitions cross-company')
    expect(typeof result.data.receivedCount).toBe('number')
  })

  test('비-SUPER 타 법인(CTR-CN): insights 404 — 격리 유지', async ({ playwright }) => {
    const cn = await playwright.request.newContext({ storageState: authFile('HR_ADMIN_CN') })
    try {
      const res = await cn.get(`/api/v1/employees/${employeeId}/insights`)
      const result = await parseApiResponse(res)
      // CTR-CN HR는 CTR 직원을 못 봄 → 회사 스코프 findFirst 실패 → 404 (200-with-data 절대 금지)
      expect(result.status, '비-SUPER가 타 법인 직원 insights 접근 시 격리').toBe(404)
    } finally {
      await cn.dispose()
    }
  })

  test('비-SUPER 타 법인(CTR-CN): recognitions = 받은 칭찬 0 — 격리 유지', async ({ playwright }) => {
    const cn = await playwright.request.newContext({ storageState: authFile('HR_ADMIN_CN') })
    try {
      const res = await cn.get(`/api/v1/cfr/recognitions/employee/${employeeId}`)
      const result = await parseApiResponse<{ receivedCount: number }>(res)
      assertOk(result, 'CN recognitions (scoped empty)')
      // companyId=CTR-CN 필터라 CTR 직원의 인정은 0건 (cross-tenant 노출 0)
      expect(result.data.receivedCount, '타 법인 인정 노출 금지').toBe(0)
    } finally {
      await cn.dispose()
    }
  })
})
