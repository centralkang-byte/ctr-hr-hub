// ═══════════════════════════════════════════════════════════
// Skills 모듈 멀티테넌트/IDOR 격리 — 역량 열람·평가 cross-tenant 차단
//   GET  /api/v1/skills/assessments?employeeId   (읽기 IDOR)
//   GET  /api/v1/skills/radar?employeeId         (읽기 IDOR)
//   GET  /api/v1/skills/team-assessments         (로스터 cross-tenant)
//   POST /api/v1/skills/team-assessments         (평가 cross-tenant + 수평권한)
// 시나리오:
//   · CTR-CN HR → CTR 직원 assessments/radar 조회 = 403 (cross-tenant read)
//   · CTR-CN HR → CTR 직원 평가 POST = 403 (cross-tenant write)
//   · CTR-CN HR 로스터 → CTR 직원 미포함 (company 격리)
//   · CTR HR → CTR 직원 조회 = 200 (자사 read 회귀)
//   · SUPER → CTR 직원 조회 = 200 (전사 read)
//   · MANAGER → 직속부하 평가 = 200 / 비-직속부하(자사) 평가 = 403 (수평권한, Codex Gate1 P1)
//   · 본인(EMPLOYEE) → 자기 assessments 조회 = 200 (self-service 회귀)
// 픽스처는 beforeAll 에서 확정 확보(없으면 throw — silent skip-pass 방지).
// ═══════════════════════════════════════════════════════════

import { test, expect, request as playwrightRequest } from '@playwright/test'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import type { RoleType } from '../helpers/auth'

async function clientFor(role: RoleType) {
  const ctx = await playwrightRequest.newContext({ storageState: authFile(role) })
  return { ctx, api: new ApiClient(ctx) }
}

function asArray<T = Record<string, unknown>>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  const d = data as { data?: T[]; items?: T[] }
  return d?.data ?? d?.items ?? []
}

const ASSESS = '/api/v1/skills/assessments'
const RADAR = '/api/v1/skills/radar'
const TEAM = '/api/v1/skills/team-assessments'
const MATRIX = '/api/v1/skills/matrix'
const GAP_REPORT = '/api/v1/skills/gap-report'
const PERIOD = 'e2e-skill-test'

interface TeamRes {
  teamMembers?: Array<{ id?: string }>
  competencies?: Array<{ id?: string }>
}

test.describe('skills cross-tenant + IDOR isolation', () => {
  test.describe.configure({ mode: 'serial' })

  let ctrEmployeeId = '' // CTR 직원 (CN 관점 타사 대상)
  let competencyId = ''
  let managerReportId = '' // 박준혁 직속부하
  let managerNonReportId = '' // CTR 직원이지만 박준혁 비-직속부하
  let managerRosterIds: string[] = [] // 박준혁 로스터 (시드 기반 스코프 검증용)
  let seedReportId = '' // 이민준 (시드 ground-truth: 박준혁 직속부하)
  let seedNonReportId = '' // 송현우 (시드 ground-truth: 김서연 직속부하 = 비-직속부하)

  test.beforeAll(async () => {
    // ── CTR 직원 + 역량 픽스처 (CTR HR) ──
    const hr = await clientFor('HR_ADMIN')
    const emps = await hr.api.get('/api/v1/employees', { limit: '50' })
    ctrEmployeeId = asArray<{ id?: string }>(emps.data)[0]?.id ?? ''
    const teamHr = await hr.api.get<TeamRes>(TEAM)
    competencyId = teamHr.data?.competencies?.[0]?.id ?? ''
    // privileged 로스터 양성 가드 — 필터 회귀로 빈 로스터가 되면 아래 CN 격리
    // 테스트가 공허하게 통과하므로 여기서 fail-loud
    if ((teamHr.data?.teamMembers ?? []).length === 0) {
      throw new Error('CTR HR 로스터가 비어 있음 — privileged 로스터 필터 회귀 의심')
    }
    await hr.ctx.dispose()

    // ── MANAGER(박준혁) 직속부하 / 비-직속부하 / 본인 ──
    const mgr = await clientFor('MANAGER')
    const team = await mgr.api.get<TeamRes>(TEAM)
    const reportIds = (team.data?.teamMembers ?? []).map((m) => m.id).filter(Boolean) as string[]
    managerRosterIds = reportIds
    managerReportId = reportIds[0] ?? ''
    const selfRadar = await mgr.api.get<{ employee?: { id?: string } }>(RADAR)
    const managerSelfId = selfRadar.data?.employee?.id ?? ''
    const mgrEmps = await mgr.api.get('/api/v1/employees', { limit: '100' })
    managerNonReportId =
      asArray<{ id?: string }>(mgrEmps.data)
        .map((e) => e.id)
        .find((id) => !!id && id !== managerSelfId && !reportIds.includes(id)) ?? ''
    // 시드 ground-truth 확보 (로스터 스코프를 엔드포인트 자체가 아닌 시드로 검증 —
    // 순환 논증 방지): 이민준 → 박준혁 직속부하, 송현우 → 김서연 직속부하
    const findByName = async (name: string) => {
      const res = await mgr.api.get('/api/v1/employees', { search: name, limit: '10' })
      return asArray<{ id?: string; name?: string }>(res.data).find((e) => e.name === name)?.id ?? ''
    }
    seedReportId = await findByName('이민준')
    seedNonReportId = await findByName('송현우')
    await mgr.ctx.dispose()

    if (
      !ctrEmployeeId || !competencyId || !managerReportId || !managerNonReportId ||
      !managerSelfId || !seedReportId || !seedNonReportId
    ) {
      throw new Error(
        `skills 픽스처 미확보: ctrEmployee=${!!ctrEmployeeId} competency=${!!competencyId} ` +
        `report=${!!managerReportId} nonReport=${!!managerNonReportId} self=${!!managerSelfId} ` +
        `seedReport(이민준)=${!!seedReportId} seedNonReport(송현우)=${!!seedNonReportId}`,
      )
    }
  })

  // ── cross-tenant READ ──
  test('CTR-CN HR → CTR 직원 assessments 조회 403', async () => {
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.get(ASSESS, { employeeId: ctrEmployeeId })
    assertError(res, 403, 'CTR-CN HR 은 CTR 직원 역량 자기평가 조회 불가')
    await ctx.dispose()
  })

  test('CTR-CN HR → CTR 직원 radar 조회 403', async () => {
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.get(RADAR, { employeeId: ctrEmployeeId })
    assertError(res, 403, 'CTR-CN HR 은 CTR 직원 역량 레이더 조회 불가')
    await ctx.dispose()
  })

  // ── cross-tenant WRITE ──
  test('CTR-CN HR → CTR 직원 평가 POST 403', async () => {
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.post(TEAM, {
      employeeId: ctrEmployeeId,
      competencyId,
      assessmentPeriod: PERIOD,
      managerLevel: 3,
    })
    assertError(res, 403, 'CTR-CN HR 은 CTR 직원 역량 평가(쓰기) 불가')
    await ctx.dispose()
  })

  // ── roster 격리 ──
  test('CTR-CN HR 로스터 → CTR 직원 미포함', async () => {
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.get<TeamRes>(TEAM)
    expect(res.status).toBe(200)
    const ids = (res.data?.teamMembers ?? []).map((m) => m.id)
    expect(ids, 'CTR 직원이 CTR-CN 로스터에 누출되면 안 됨').not.toContain(ctrEmployeeId)
    await ctx.dispose()
  })

  // ── 자사 read 회귀 ──
  test('회귀: CTR HR → CTR 직원 assessments 조회 200', async () => {
    const { ctx, api } = await clientFor('HR_ADMIN')
    const res = await api.get(ASSESS, { employeeId: ctrEmployeeId })
    assertOk(res, 'CTR HR 은 자사 직원 역량 조회 가능')
    await ctx.dispose()
  })

  test('회귀: CTR HR → CTR 직원 radar 조회 200', async () => {
    const { ctx, api } = await clientFor('HR_ADMIN')
    const res = await api.get(RADAR, { employeeId: ctrEmployeeId })
    assertOk(res, 'CTR HR 은 자사 직원 레이더 조회 가능')
    await ctx.dispose()
  })

  // ── SUPER 전사 read ──
  test('SUPER → CTR 직원 assessments 조회 200 (전사)', async () => {
    const { ctx, api } = await clientFor('SUPER_ADMIN')
    const res = await api.get(ASSESS, { employeeId: ctrEmployeeId })
    assertOk(res, 'SUPER 는 전사 역량 조회 가능')
    await ctx.dispose()
  })

  // ── MANAGER 로스터 스코프 (시드 ground-truth — 부서 fallback 제거 회귀 가드) ──
  test('MANAGER 로스터 = 직속부하만 (시드 기준: 이민준 포함·송현우 제외)', async () => {
    expect(managerRosterIds, '직속부하 이민준은 로스터에 있어야 함').toContain(seedReportId)
    expect(managerRosterIds, '비-직속부하 송현우가 로스터에 나오면 안 됨 (부서/자사 누출)')
      .not.toContain(seedNonReportId)
  })

  // ── EMPLOYEE 수평 IDOR read ──
  test('EMPLOYEE → 타인 assessments 조회 403 (수평 IDOR read)', async () => {
    const { ctx, api } = await clientFor('EMPLOYEE')
    const res = await api.get(ASSESS, { employeeId: managerNonReportId })
    assertError(res, 403, 'EMPLOYEE 는 타인 역량 조회 불가')
    await ctx.dispose()
  })

  // ── matrix 로스터형 게이트 ──
  test('EMPLOYEE → skills/matrix 403 (자사 전직원 레벨 덤프 차단)', async () => {
    const { ctx, api } = await clientFor('EMPLOYEE')
    const res = await api.get(MATRIX)
    assertError(res, 403, 'EMPLOYEE 는 스킬 매트릭스 조회 불가')
    await ctx.dispose()
  })

  test('회귀: HR → skills/matrix 200', async () => {
    const { ctx, api } = await clientFor('HR_ADMIN')
    const res = await api.get(MATRIX)
    assertOk(res, 'HR 은 자사 스킬 매트릭스 조회 가능')
    await ctx.dispose()
  })

  // ── gap-report 게이트 = matrix 정합 (MANAGER/EXEC 403 → 페이지 전체 공백 선재버그 회귀 가드) ──
  test('MANAGER → skills/gap-report 200 (matrix 와 동일 role 집합)', async () => {
    const { ctx, api } = await clientFor('MANAGER')
    const res = await api.get(GAP_REPORT)
    assertOk(res, 'MANAGER 는 자사 스킬 갭 리포트 조회 가능 (스킬 매트릭스 페이지 필수 데이터)')
    await ctx.dispose()
  })

  test('EXECUTIVE → skills/gap-report 200 (matrix 와 동일 role 집합)', async () => {
    const { ctx, api } = await clientFor('EXECUTIVE')
    const res = await api.get(GAP_REPORT)
    assertOk(res, 'EXECUTIVE 는 자사 스킬 갭 리포트 조회 가능 (스킬 매트릭스 페이지 필수 데이터)')
    await ctx.dispose()
  })

  test('EMPLOYEE → skills/gap-report 403 (로스터형 게이트)', async () => {
    const { ctx, api } = await clientFor('EMPLOYEE')
    const res = await api.get(GAP_REPORT)
    assertError(res, 403, 'EMPLOYEE 는 스킬 갭 리포트 조회 불가')
    await ctx.dispose()
  })

  // ── MANAGER 수평권한 (직속부하만 평가) ──
  test('MANAGER → 직속부하 평가 POST 허용', async () => {
    const { ctx, api } = await clientFor('MANAGER')
    const res = await api.post(TEAM, {
      employeeId: managerReportId,
      competencyId,
      assessmentPeriod: PERIOD,
      managerLevel: 4,
    })
    assertOk(res, 'MANAGER 는 직속부하 역량 평가 가능')
    await ctx.dispose()
  })

  test('MANAGER → 비-직속부하(자사) 평가 POST 403 (수평권한 차단)', async () => {
    const { ctx, api } = await clientFor('MANAGER')
    const res = await api.post(TEAM, {
      employeeId: managerNonReportId,
      competencyId,
      assessmentPeriod: PERIOD,
      managerLevel: 4,
    })
    assertError(res, 403, 'MANAGER 는 직속부하가 아닌 자사 직원 평가 불가')
    await ctx.dispose()
  })

  // ── self-service 회귀 ──
  test('본인(EMPLOYEE) → 자기 assessments 조회 200', async () => {
    const { ctx, api } = await clientFor('EMPLOYEE')
    const res = await api.get(ASSESS)
    assertOk(res, '직원 본인 역량 자기평가 조회 가능')
    await ctx.dispose()
  })
})
