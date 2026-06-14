// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Performance/CFR Authorization Gate Regression
//
// 성과·동료평가 도메인 employeeId-스코프 엔드포인트의 역할/IDOR 게이트.
// perm(PERFORMANCE, VIEW)는 EMPLOYEE도 보유하므로, 핸들러 레벨 게이트가
// 없으면 무관한 직원이 타인 등급·동료평가자 신원·협업그래프를 조회할 수 있었다.
// 각 엔드포인트: 무관한 EMPLOYEE → 403, 권한 역할(HR_ADMIN) → 403 아님.
// SSOT 게이트 헬퍼: src/lib/performance/peer-access.ts
// ═══════════════════════════════════════════════════════════

import { test, expect, request as playwrightRequest } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { ApiClient } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import { resolveSeedData } from '../helpers/test-data'
import { createTestCycle, cleanupTestCycle } from '../helpers/eval-fixtures'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002'
// 임의 uuid (cycleId uuid 스키마 충족용 — 게이트는 cycle 존재 이전/무관하게 발화)
const FAKE_UUID = '00000000-0000-0000-0000-000000000000'

test.describe('Performance authz gates: employeeId-scoped IDOR/role gates', () => {
  test.describe.configure({ mode: 'serial' })

  let cycleId = ''
  let employeeId = '' // 이민준 (EMPLOYEE_A) — 조회 "대상"

  function ctx(role: Parameters<typeof authFile>[0]): Promise<APIRequestContext> {
    return playwrightRequest.newContext({ baseURL: BASE, storageState: authFile(role) })
  }

  test.beforeAll(async () => {
    const hr = await ctx('HR_ADMIN')
    const seed = await resolveSeedData(hr)
    employeeId = seed.employeeId
    expect(employeeId, 'employeeId(이민준) must resolve').toBeTruthy()
    cycleId = await createTestCycle(hr, { name: `E2E AuthzGate ${Date.now()}`, year: 2095, half: 'H2' })
    await hr.dispose()
  })

  test.afterAll(async () => {
    if (cycleId) {
      const hr = await ctx('HR_ADMIN')
      await cleanupTestCycle(hr, cycleId).catch(() => {})
      await hr.dispose()
    }
  })

  // 각 엔드포인트: [라벨, path/query 빌더]. EMPLOYEE_C(송현우)는 이민준과 무관.
  function endpoints(): { label: string; path: string }[] {
    return [
      {
        label: 'cycle participants (전 직원 등급/overdue)',
        path: `/api/v1/performance/cycles/${cycleId}/participants`,
      },
      {
        label: 'peer-review nominations (reviewer↔대상 매핑)',
        path: `/api/v1/peer-review/nominations?cycleId=${cycleId}`,
      },
      {
        label: 'peer-review results query-param (reviewer 신원)',
        path: `/api/v1/peer-review/results?cycleId=${cycleId}&employeeId=${employeeId}`,
      },
      {
        label: 'checkins status (체크인/overdue)',
        path: `/api/v1/performance/checkins/${cycleId}/status`,
      },
      {
        label: 'peer-review recommend (협업그래프)',
        path: `/api/v1/peer-review/recommend?employeeId=${employeeId}&cycleId=${cycleId}`,
      },
      {
        label: 'peer-review candidates (지명 로스터)',
        path: `/api/v1/performance/peer-review/candidates?cycleId=${cycleId}&employeeId=${employeeId}`,
      },
    ]
  }

  test('unrelated EMPLOYEE → 403 on every employeeId-scoped endpoint', async () => {
    const emp = await ctx('EMPLOYEE_C') // 송현우 — 이민준과 무관, 비담당
    const api = new ApiClient(emp)
    for (const ep of endpoints()) {
      const res = await api.get(ep.path)
      expect(res.status, `${ep.label} — unrelated EMPLOYEE must be forbidden`).toBe(403)
    }
    await emp.dispose()
  })

  test('HR_ADMIN → not forbidden (privileged path preserved)', async () => {
    const hr = await ctx('HR_ADMIN')
    const api = new ApiClient(hr)
    for (const ep of endpoints()) {
      const res = await api.get(ep.path)
      // 데이터에 따라 200/400/404 가능 — 단지 403/401이 아니어야 한다(권한 보존).
      expect([401, 403], `${ep.label} — HR_ADMIN must not be blocked`).not.toContain(res.status)
    }
    await hr.dispose()
  })

  // candidates: uuid 스키마라 존재하지 않는 cycle uuid로도 게이트(같은 법인 IDOR)가 먼저 발화하는지 확인
  test('candidates with arbitrary uuid cycle still blocks unrelated EMPLOYEE → 403', async () => {
    const emp = await ctx('EMPLOYEE_C')
    const res = await new ApiClient(emp).get(
      `/api/v1/performance/peer-review/candidates?cycleId=${FAKE_UUID}&employeeId=${employeeId}`,
    )
    expect(res.status).toBe(403)
    await emp.dispose()
  })
})
