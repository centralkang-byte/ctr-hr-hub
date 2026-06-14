// ═══════════════════════════════════════════════════════════
// CTR HR Hub — My Performance History (reviews/my-history)
//
// 프로필 다주기 평가이력 소스. 검증:
//   - 미통보(notifiedAt=null) cycle은 이력에 나타나지 않음 (코멘트·MBO 누출 0)
//   - 통보 후 나타나며, 응답 계약(평가자명·코멘트·MBO 집계 필드) 충족 +
//     마스킹 필드(calibrationNote·originalGrade) 미포함
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

interface HistoryItem {
  cycleId: string
  evaluatorName: string | null
  comment: string | null
  mboGoalCount: number
  mboAchievement: number | null
  mboKeyGoals: string[]
  [key: string]: unknown
}

test.describe('My performance history: publication boundary + contract', () => {
  test.describe.configure({ mode: 'serial' })

  let cycleId = ''

  function ctx(role: Parameters<typeof authFile>[0]): Promise<APIRequestContext> {
    return playwrightRequest.newContext({ baseURL: BASE, storageState: authFile(role) })
  }

  const myHistory = '/api/v1/performance/reviews/my-history'

  test.beforeAll(async () => {
    const hr = await ctx('HR_ADMIN')
    const seed = await resolveSeedData(hr)
    expect(seed.employeeId).toBeTruthy()
    cycleId = await createTestCycle(hr, { name: `E2E History ${Date.now()}`, year: 2095, half: 'H2' })
    await advanceTo(hr, cycleId, 'CLOSED')
    await hr.dispose()
    // 통보 전 상태 보장: 본인 리뷰 notifiedAt = null
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

  test('1. unnotified cycle is absent from history (no leak)', async () => {
    const emp = await ctx('EMPLOYEE')
    const res = await new ApiClient(emp).get(myHistory)
    expect(res.status).toBe(200)
    const list = (res.data ?? []) as HistoryItem[]
    expect(Array.isArray(list)).toBe(true)
    expect(list.find((h) => h.cycleId === cycleId), 'unnotified cycle must not appear').toBeUndefined()
    await emp.dispose()
  })

  test('2. after notification → cycle appears with contract fields, no masked fields', async () => {
    await dbQuery(
      `UPDATE performance_reviews SET notified_at = now()
       WHERE cycle_id = $1 AND employee_id = (SELECT id FROM employees WHERE email = $2 LIMIT 1)`,
      [cycleId, EMP_EMAIL],
    )
    const emp = await ctx('EMPLOYEE')
    const res = await new ApiClient(emp).get(myHistory)
    expect(res.status).toBe(200)
    const list = (res.data ?? []) as HistoryItem[]
    const item = list.find((h) => h.cycleId === cycleId)
    expect(item, 'notified cycle must appear in history').toBeTruthy()
    // 계약 필드 존재 (값은 데이터에 따라 null 가능)
    expect(item).toHaveProperty('evaluatorName')
    expect(item).toHaveProperty('comment')
    expect(typeof item!.mboGoalCount).toBe('number')
    expect(item).toHaveProperty('mboAchievement')
    expect(Array.isArray(item!.mboKeyGoals)).toBe(true)
    // 마스킹 필드는 절대 미포함
    expect(item).not.toHaveProperty('calibrationNote')
    expect(item).not.toHaveProperty('originalGrade')
    await emp.dispose()
  })
})
