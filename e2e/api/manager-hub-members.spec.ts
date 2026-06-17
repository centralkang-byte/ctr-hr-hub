// ═══════════════════════════════════════════════════════════
// Manager-Hub 5-tab IA (PR-1) — members 로스터 + 팀 공지 가드
//   GET  /api/v1/manager-hub/members   — 직속부하 로스터 (MANAGER+)
//   POST /api/v1/manager-hub/announce  — 팀 공지 (MANAGER+)
// 스코프: MANAGER 는 본인 직속부하만 · EMPLOYEE 403 · 빈 입력 400.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'

const MEMBERS = '/api/v1/manager-hub/members'
const ANNOUNCE = '/api/v1/manager-hub/announce'

interface RosterMember {
  id: string
  name: string
  positionTitle: string
  overtimeMinutesMonth: number
  leaveUsagePct: number | null
  performanceGrade: string | null
  riskBand: 'LOW' | 'MEDIUM' | 'HIGH'
  status: string
}

test.describe('manager-hub members — MANAGER (박준혁)', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('GET members -> 200, roster array with expected shape', async ({ request }) => {
    const c = new ApiClient(request)
    const res = await c.get<{ members: RosterMember[] }>(MEMBERS)
    assertOk(res, 'members GET (MANAGER)')
    expect(Array.isArray(res.data?.members)).toBe(true)
    const members = res.data?.members ?? []
    // 박준혁 직속부하(이민준·정다은)는 시드상 1명 이상.
    expect(members.length).toBeGreaterThan(0)
    for (const m of members) {
      expect(typeof m.id).toBe('string')
      expect(typeof m.name).toBe('string')
      // leaveUsagePct 는 number 또는 null (annual available<=0 → null)
      expect(m.leaveUsagePct === null || typeof m.leaveUsagePct === 'number').toBe(true)
      // performanceGrade 는 통보된 등급만 — 미공개는 null
      expect(m.performanceGrade === null || typeof m.performanceGrade === 'string').toBe(true)
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(m.riskBand)
    }
  })

  test('POST announce -> 200, sent count returned', async ({ request }) => {
    const c = new ApiClient(request)
    const res = await c.post<{ sent: number }>(ANNOUNCE, {
      title: 'E2E 팀 공지',
      body: 'E2E 테스트 팀 공지 내용입니다.',
    })
    assertOk(res, 'announce POST (MANAGER)')
    expect(typeof res.data?.sent).toBe('number')
  })

  test('POST announce empty title -> 400', async ({ request }) => {
    const c = new ApiClient(request)
    const res = await c.post(ANNOUNCE, { title: '', body: '내용만 있음' })
    assertError(res, 400, 'announce empty title')
  })

  test('POST announce empty body -> 400', async ({ request }) => {
    const c = new ApiClient(request)
    const res = await c.post(ANNOUNCE, { title: '제목만 있음', body: '' })
    assertError(res, 400, 'announce empty body')
  })
})

test.describe('manager-hub members — EMPLOYEE forbidden', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET members as EMPLOYEE -> 403', async ({ request }) => {
    const c = new ApiClient(request)
    const res = await c.get(MEMBERS)
    assertError(res, 403, 'members GET (EMPLOYEE)')
  })

  test('POST announce as EMPLOYEE -> 403', async ({ request }) => {
    const c = new ApiClient(request)
    const res = await c.post(ANNOUNCE, { title: '공지', body: '내용' })
    assertError(res, 403, 'announce POST (EMPLOYEE)')
  })
})
