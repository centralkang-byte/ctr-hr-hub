// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Result Publication Gate (per-review notifiedAt)
//
// 결과 공개는 cycle status가 아니라 본인 PerformanceReview.notifiedAt(단조)로 판정한다.
//   - CLOSED이지만 미통보(notifiedAt=null) → 직원이 등급/동료점수 조기 열람 불가 (400)
//   - 통보(notifiedAt set) 후 → 200
//   - 이후 cycle이 COMP_COMPLETED로 진행해도 → 여전히 200 (notifiedAt 단조, 비공개 회귀 없음)
// 게이트: reviews/my-result · performance/peer-review/results/[employeeId]
// ═══════════════════════════════════════════════════════════

import { test, expect, request as playwrightRequest } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { ApiClient } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import { resolveSeedData } from '../helpers/test-data'
import { createTestCycle, advanceTo, cleanupTestCycle } from '../helpers/eval-fixtures'
import { dbQuery, closeDb } from '../helpers/db'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002'
const EMP_EMAIL = 'employee-a@ctr.co.kr' // 이민준

test.describe('Result publication gate: per-review notifiedAt', () => {
  test.describe.configure({ mode: 'serial' })

  let cycleId = ''
  let employeeId = '' // 이민준

  function ctx(role: Parameters<typeof authFile>[0]): Promise<APIRequestContext> {
    return playwrightRequest.newContext({ baseURL: BASE, storageState: authFile(role) })
  }

  const myResult = `/api/v1/performance/reviews/my-result`
  const peerResults = (id: string) => `/api/v1/performance/peer-review/results/${id}`

  test.beforeAll(async () => {
    const hr = await ctx('HR_ADMIN')
    employeeId = (await resolveSeedData(hr)).employeeId
    expect(employeeId).toBeTruthy()
    // H2 주기를 CLOSED까지 진행 (initialize가 참여자 PerformanceReview 생성, notifiedAt=null)
    cycleId = await createTestCycle(hr, { name: `E2E PubGate ${Date.now()}`, year: 2094, half: 'H2' })
    await advanceTo(hr, cycleId, 'CLOSED')
    await hr.dispose()
    // 통보 전 상태 보장 (방어적): 이 주기 본인 리뷰 notifiedAt = null
    await dbQuery(
      `UPDATE performance_reviews SET notified_at = NULL
       WHERE cycle_id = $1 AND employee_id = (SELECT id FROM employees WHERE email = $2 LIMIT 1)`,
      [cycleId, EMP_EMAIL],
    )
  })

  test.afterAll(async () => {
    if (cycleId) {
      const hr = await ctx('HR_ADMIN')
      await cleanupTestCycle(hr, cycleId).catch(() => {})
      await hr.dispose()
    }
    await closeDb()
  })

  test('1. CLOSED but not notified → my-result blocked (400)', async () => {
    const emp = await ctx('EMPLOYEE')
    const res = await new ApiClient(emp).get(myResult, { cycleId })
    expect(res.status, 'unnotified result must be hidden').toBe(400)
    await emp.dispose()
  })

  test('2. CLOSED but not notified → peer-review results blocked (400)', async () => {
    const emp = await ctx('EMPLOYEE')
    const res = await new ApiClient(emp).get(peerResults(employeeId), { cycleId })
    expect(res.status, 'unnotified peer results must be hidden').toBe(400)
    await emp.dispose()
  })

  test('3. after notification → my-result accessible (200)', async () => {
    await dbQuery(
      `UPDATE performance_reviews SET notified_at = now()
       WHERE cycle_id = $1 AND employee_id = (SELECT id FROM employees WHERE email = $2 LIMIT 1)`,
      [cycleId, EMP_EMAIL],
    )
    const emp = await ctx('EMPLOYEE')
    const res = await new ApiClient(emp).get(myResult, { cycleId })
    expect(res.status, 'notified result must be visible').toBe(200)
    await emp.dispose()
  })

  // CALIBRATION은 status-only 게이트(isResultPublishedForRole)면 false라 회귀(통보 후 비공개)가
  // 났던 지점 — notifiedAt 단조 신호로 200을 유지해야 한다.
  test('4. notifiedAt is monotonic — still visible after advancing to CALIBRATION', async () => {
    const hr = await ctx('HR_ADMIN')
    await advanceTo(hr, cycleId, 'CALIBRATION')
    await hr.dispose()
    const emp = await ctx('EMPLOYEE')
    const res = await new ApiClient(emp).get(myResult, { cycleId })
    expect(res.status, 'notified result must remain visible post-notification').toBe(200)
    await emp.dispose()
  })
})
