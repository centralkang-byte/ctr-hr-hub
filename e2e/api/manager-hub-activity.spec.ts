// ═══════════════════════════════════════════════════════════
// Manager-Hub 5-tab IA (PR-2) — 활동 집계 + 스코프 가드
//   GET /api/v1/manager-hub/activity  — 1:1·칭찬·주간일정·위임 (MANAGER+)
// 스코프: MANAGER 본인 1:1/칭찬/위임 + 직속부하 주간휴가 · EMPLOYEE 403 · 전 섹션 법인 스코프.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'

const ACTIVITY = '/api/v1/manager-hub/activity'

interface ActivityResponse {
  weekDates: string[]
  oneOnOnes: Array<{ id: string; employee: { id: string; name: string }; scheduledAt: string; meetingType: string }>
  recognitions: Array<{ id: string; receiver: { id: string; name: string }; coreValue: string; message: string }>
  weeklyLeave: Array<{ id: string; employee: { id: string; name: string }; startDate: string; endDate: string }>
  delegations: Array<{ id: string; delegatee: { id: string; name: string }; scope: string }>
  counts: {
    upcomingOneOnOnes: number
    completedOneOnOnesQuarter: number
    sentRecognitionsQuarter: number
    activeDelegations: number
  }
}

test.describe('manager-hub activity — MANAGER (박준혁)', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('GET activity -> 200, four sections + counts', async ({ request }) => {
    const c = new ApiClient(request)
    const res = await c.get<ActivityResponse>(ACTIVITY)
    assertOk(res, 'activity GET (MANAGER)')
    const d = res.data
    expect(Array.isArray(d?.oneOnOnes)).toBe(true)
    expect(Array.isArray(d?.recognitions)).toBe(true)
    expect(Array.isArray(d?.weeklyLeave)).toBe(true)
    expect(Array.isArray(d?.delegations)).toBe(true)
    expect(typeof d?.counts?.upcomingOneOnOnes).toBe('number')
    expect(typeof d?.counts?.completedOneOnOnesQuarter).toBe('number')
    expect(typeof d?.counts?.sentRecognitionsQuarter).toBe('number')
    expect(typeof d?.counts?.activeDelegations).toBe('number')
    // weekDates = 이번 주 월~금 5개 연속 'yyyy-MM-dd' (tz 경계 회귀 가드 — 데이터 유무 무관 항상 검증).
    const wd = d?.weekDates ?? []
    expect(wd.length).toBe(5)
    for (const s of wd) expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    for (let i = 0; i < wd.length; i++) {
      const [y, m, day] = wd[i].split('-').map(Number)
      // 월(1)~금(5)
      expect(new Date(Date.UTC(y, m - 1, day)).getUTCDay()).toBe(i + 1)
      if (i > 0) {
        const prev = new Date(`${wd[i - 1]}T00:00:00Z`).getTime()
        const cur = new Date(`${wd[i]}T00:00:00Z`).getTime()
        expect(cur - prev).toBe(86_400_000) // 연속 하루
      }
    }
    // 1:1 은 본인이 매니저인 건만 — scheduledAt 은 ISO 문자열.
    for (const o of d?.oneOnOnes ?? []) {
      expect(typeof o.id).toBe('string')
      expect(typeof o.employee?.name).toBe('string')
      expect(Number.isNaN(Date.parse(o.scheduledAt))).toBe(false)
    }
    // 위임 활성건 수 == delegations 배열 길이 (counts 정합).
    expect(d?.counts?.activeDelegations).toBe((d?.delegations ?? []).length)
  })

  // 스코프 가드: 주간 휴가는 "직속부하"로 제한 — members 로스터 밖 직원은 안 나와야 함.
  // (cross-company 격리는 라우트 companyId 스코프 + residual-cross-tenant 스위트가 별도 커버)
  test('weeklyLeave employees ⊆ direct-report roster', async ({ request }) => {
    const c = new ApiClient(request)
    const roster = await c.get<{ members: Array<{ id: string }> }>('/api/v1/manager-hub/members')
    assertOk(roster, 'members GET (for scope cross-check)')
    const memberIds = new Set((roster.data?.members ?? []).map((m) => m.id))

    const res = await c.get<ActivityResponse>(ACTIVITY)
    assertOk(res, 'activity GET (scope)')
    for (const l of res.data?.weeklyLeave ?? []) {
      expect(memberIds.has(l.employee.id)).toBe(true)
    }
  })
})

test.describe('manager-hub activity — EMPLOYEE forbidden', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET activity as EMPLOYEE -> 403', async ({ request }) => {
    const c = new ApiClient(request)
    const res = await c.get(ACTIVITY)
    assertError(res, 403, 'activity GET (EMPLOYEE)')
  })
})
