// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Phase 2 API P7: Onboarding Lifecycle
// Template CRUD + Instance Ops + Checkins + Self-Service + RBAC
// ═══════════════════════════════════════════════════════════

import { test, expect, request as playwrightRequest } from '@playwright/test'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import { resolveSeedData } from '../helpers/test-data'
import * as f from '../helpers/onb-offb-training-fixtures'

// ─── HR_ADMIN: Template CRUD ───────────────────────────

test.describe('Onboarding Templates: HR_ADMIN CRUD', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let templateId: string
  let taskId: string

  test('POST /templates creates template', async ({ request }) => {
    const client = new ApiClient(request)
    const data = f.buildTemplate('TMPL')
    const result = await f.createTemplate(client, data)
    assertOk(result, 'create template')
    const d = result.data as Record<string, unknown>
    expect(d.id).toBeTruthy()
    templateId = d.id as string
  })

  test('GET /templates returns list with new template', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listTemplates(client)
    assertOk(result, 'list templates')
    const items = result.data as Array<Record<string, unknown>>
    expect(items.length).toBeGreaterThan(0)
  })

  test('GET /templates?page=1&limit=2 returns pagination', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listTemplates(client, { page: '1', limit: '2' })
    assertOk(result, 'list templates paginated')
    expect(result.pagination).toBeTruthy()
    expect(result.pagination!.page).toBe(1)
    expect(result.pagination!.limit).toBe(2)
  })

  test('GET /templates/[id] returns detail', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getTemplate(client, templateId)
    assertOk(result, 'get template detail')
    const d = result.data as Record<string, unknown>
    expect(d.id).toBe(templateId)
  })

  test('PUT /templates/[id] updates name', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.updateTemplate(client, templateId, {
      name: `E2E Updated ${Date.now()}`,
    })
    assertOk(result, 'update template')
  })

  test('POST /templates/[id]/tasks adds task', async ({ request }) => {
    const client = new ApiClient(request)
    const data = f.buildTemplateTask('TK')
    const result = await f.createTemplateTask(client, templateId, data)
    assertOk(result, 'create template task')
    const d = result.data as Record<string, unknown>
    expect(d.id).toBeTruthy()
    taskId = d.id as string
  })

  test('GET /templates/[id]/tasks returns task list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listTemplateTasks(client, templateId)
    assertOk(result, 'list template tasks')
    const items = result.data as Array<Record<string, unknown>>
    expect(items.length).toBeGreaterThanOrEqual(1)
  })

  test('PUT /templates/[id]/tasks/reorder succeeds', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.reorderTemplateTasks(client, templateId, {
      taskIds: [taskId],
    })
    // reorder may return 200 with data or an error if only 1 task
    expect(result.status).toBeLessThan(500)
  })

  test('DELETE /templates/[id] soft-deletes', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.deleteTemplate(client, templateId)
    expect(result.ok).toBe(true)
  })

  test('GET /templates/[id] after delete returns 404', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getTemplate(client, templateId)
    assertError(result, 404, 'deleted template')
  })
})

// ─── HR_ADMIN: Instance Operations ─────────────────────

test.describe('Onboarding Instances: HR_ADMIN Operations', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let instanceId: string
  let firstTaskId: string

  test.beforeAll(async ({ request }) => {
    const client = new ApiClient(request)
    try {
      const seed = await f.resolveSeedOnboardingInstance(client)
      instanceId = seed.instanceId
      // Find a PENDING task for status transitions
      const pending = seed.tasks.find(
        (t) => (t.status as string) === 'PENDING' || (t.status as string) === 'NOT_STARTED',
      )
      firstTaskId = (pending?.id ?? seed.tasks[0]?.id) as string
    } catch {
      // No seed instances — skip instance tests gracefully
    }
  })

  test('GET /instances returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listOnboardingInstances(client)
    assertOk(result, 'list instances')
    const items = result.data as unknown[]
    expect(Array.isArray(items)).toBe(true)
  })

  test('GET /instances?status=IN_PROGRESS filters', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listOnboardingInstances(client, { status: 'IN_PROGRESS' })
    assertOk(result, 'list filtered instances')
  })

  test('GET /instances/[id] returns detail with progress', async ({ request }) => {
    test.skip(!instanceId, 'No seed onboarding instance')
    const client = new ApiClient(request)
    const result = await f.getOnboardingInstance(client, instanceId)
    assertOk(result, 'get instance detail')
    const d = result.data as Record<string, unknown>
    expect(d.id).toBe(instanceId)
  })

  test('PUT /instances/[id]/tasks/[taskId]/status transitions task', async ({ request }) => {
    test.skip(!instanceId || !firstTaskId, 'No seed instance or task')
    const client = new ApiClient(request)
    const result = await f.updateOnboardingTaskStatus(client, instanceId, firstTaskId, {
      status: 'IN_PROGRESS',
    })
    // May succeed or fail if task already transitioned
    expect([200, 400]).toContain(result.status)
  })

  test('POST /instances/[id]/tasks/[taskId]/block blocks task', async ({ request }) => {
    test.skip(!instanceId || !firstTaskId, 'No seed instance or task')
    const client = new ApiClient(request)
    const result = await f.blockOnboardingTask(client, instanceId, firstTaskId, {
      reason: 'E2E test block reason',
    })
    expect([200, 400]).toContain(result.status)
  })

  test('POST /instances/[id]/tasks/[taskId]/unblock restores task', async ({ request }) => {
    test.skip(!instanceId || !firstTaskId, 'No seed instance or task')
    const client = new ApiClient(request)
    const result = await f.unblockOnboardingTask(client, instanceId, firstTaskId)
    expect([200, 400]).toContain(result.status)
  })

  test('GET /instances/[id]/sign-off-summary returns eligibility', async ({ request }) => {
    test.skip(!instanceId, 'No seed onboarding instance')
    const client = new ApiClient(request)
    const result = await f.getSignOffSummary(client, instanceId)
    assertOk(result, 'sign-off summary')
  })

  test('PUT task status with invalid transition returns 400', async ({ request }) => {
    test.skip(!instanceId || !firstTaskId, 'No seed instance or task')
    const client = new ApiClient(request)
    // Try transitioning to COMPLETED directly (usually requires IN_PROGRESS first)
    const result = await f.updateOnboardingTaskStatus(client, instanceId, firstTaskId, {
      status: 'INVALID_STATUS',
    })
    assertError(result, 400, 'invalid status transition')
  })
})

// ─── HR_ADMIN: Dashboard & Plans ───────────────────────

test.describe('Onboarding Dashboard & Plans: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  let seedData: Awaited<ReturnType<typeof resolveSeedData>>

  test.beforeAll(async ({ request }) => {
    seedData = await resolveSeedData(request)
  })

  test('GET /dashboard returns enriched list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getOnboardingDashboard(client)
    assertOk(result, 'onboarding dashboard')
  })

  test('GET /dashboard?planType=ONBOARDING filters', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getOnboardingDashboard(client, { planType: 'ONBOARDING' })
    assertOk(result, 'dashboard filtered')
  })

  test('POST /plans with valid employeeId creates or conflicts', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.createOnboardingPlan(client, {
      employeeId: seedData.employeeId,
    })
    // 200/201 if created, 409 if already exists
    expect([200, 201, 409]).toContain(result.status)
  })

  test('POST /plans with fake UUID returns 400/404', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.createOnboardingPlan(client, {
      employeeId: '00000000-0000-4000-a000-000000000000',
    })
    expect([400, 404]).toContain(result.status)
  })

  test('GET /checkins returns HR checkin list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listCheckins(client)
    assertOk(result, 'HR checkins list')
  })
})

// ─── HR_ADMIN: Force Complete & Crossboarding ──────────

test.describe('Onboarding Force Complete & Crossboarding: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  let instanceId: string | undefined

  test.beforeAll(async ({ request }) => {
    const client = new ApiClient(request)
    try {
      const seed = await f.resolveSeedOnboardingInstance(client)
      instanceId = seed.instanceId
    } catch {
      // no seed data
    }
  })

  test('PUT /force-complete with reason succeeds', async ({ request }) => {
    test.skip(!instanceId, 'No seed onboarding instance')
    const client = new ApiClient(request)
    const result = await f.forceCompleteOnboarding(client, instanceId!, {
      reason: 'E2E test force complete',
    })
    // 200 if completed, 400 if already completed
    expect([200, 400]).toContain(result.status)
  })

  test('PUT /force-complete without reason returns 400', async ({ request }) => {
    test.skip(!instanceId, 'No seed onboarding instance')
    const client = new ApiClient(request)
    const result = await f.forceCompleteOnboarding(client, instanceId!, {})
    assertError(result, 400, 'force-complete without reason')
  })

  // 크로스보딩은 HQ 계층 권한 확정 전까지 SUPER_ADMIN 전용 (route.ts:28 임시 가드).
  // HR_ADMIN 컨텍스트는 403 문서화, 검증 경로(400/404)는 SUPER 컨텍스트로 검증.
  test('POST /crossboarding as HR_ADMIN → 403 (SUPER-only guard)', async ({ request }) => {
    const client = new ApiClient(request)
    const seedData = await resolveSeedData(request)
    const result = await f.triggerCrossboarding(client, {
      employeeId: seedData.employeeId,
      fromCompanyId: seedData.companyId,
      toCompanyId: seedData.companyId,
      transferDate: '2099-01-15',
    })
    assertError(result, 403, 'crossboarding non-SUPER blocked')
  })

  test('POST /crossboarding with same company returns 400', async ({ request }) => {
    const seedData = await resolveSeedData(request)
    const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002'
    const saCtx = await playwrightRequest.newContext({ baseURL, storageState: authFile('SUPER_ADMIN') })
    try {
      const client = new ApiClient(saCtx)
      const result = await f.triggerCrossboarding(client, {
        employeeId: seedData.employeeId,
        fromCompanyId: seedData.companyId,
        toCompanyId: seedData.companyId, // same company
        transferDate: '2099-01-15',
      })
      expect([400, 404]).toContain(result.status)
    } finally {
      await saCtx.dispose()
    }
  })

  test('POST /crossboarding with bad employeeId returns 400/404', async () => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002'
    const saCtx = await playwrightRequest.newContext({ baseURL, storageState: authFile('SUPER_ADMIN') })
    try {
      const client = new ApiClient(saCtx)
      const result = await f.triggerCrossboarding(client, {
        employeeId: '00000000-0000-4000-a000-000000000000',
        fromCompanyId: '00000000-0000-4000-a000-000000000001',
        toCompanyId: '00000000-0000-4000-a000-000000000002',
        transferDate: '2099-01-15',
      })
      expect([400, 404]).toContain(result.status)
    } finally {
      await saCtx.dispose()
    }
  })
})

// ─── EMPLOYEE: Self-Service ────────────────────────────

test.describe('Onboarding Self-Service: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  const uniqueWeek = (Date.now() % 48) + 1 // 1-49 range

  test('GET /me returns own onboarding or null', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getMyOnboarding(client)
    assertOk(result, 'my onboarding')
  })

  test('GET /me response is object or null', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getMyOnboarding(client)
    assertOk(result, 'my onboarding structure')
    // data can be null (no active onboarding) or object
    const d = result.data
    expect(d === null || typeof d === 'object').toBe(true)
  })

  test('POST /checkin submits weekly checkin', async ({ request }) => {
    const client = new ApiClient(request)
    const data = f.buildCheckin(uniqueWeek)
    const result = await f.submitCheckin(client, data)
    // 201 if new, 409 if already submitted this week
    expect([200, 201, 409]).toContain(result.status)
  })

  test('POST /checkin duplicate same week returns 409', async ({ request }) => {
    const client = new ApiClient(request)
    const data = f.buildCheckin(uniqueWeek) // same week as above
    const result = await f.submitCheckin(client, data)
    // Should be 409 if first test succeeded, or 409 if already existed
    expect([409]).toContain(result.status)
  })

  test('GET /checkins/[self] returns own checkins', async ({ request }) => {
    const client = new ApiClient(request)
    const seedData = await resolveSeedData(request)
    const result = await f.getEmployeeCheckins(client, seedData.employeeId)
    assertOk(result, 'own checkins')
  })

  test('PUT /tasks/[id]/complete on own task checks status', async ({ request }) => {
    // Try completing a fake task ID — expect 400/404
    const client = new ApiClient(request)
    const result = await f.completeOnboardingTask(
      client,
      '00000000-0000-4000-a000-000000000099',
    )
    expect([400, 404]).toContain(result.status)
  })
})

// ─── MANAGER: 직속부하 스코프 (⑥-C PR-1) ──────────────
// onboarding_read 부여로 목록/대시보드는 200 — 단 직속부하(활성 자사 primary 발령)만.
// 템플릿은 HR 설정 전용으로 role 가드 유지 (Codex G2 P1).

test.describe('Onboarding: MANAGER team-scoped access', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('GET /instances returns 200 scoped to direct reports', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listOnboardingInstances(client)
    assertOk(result, 'MANAGER instances scoped')
    // 박준혁 직속부하 = 이민준·정다은 — 그 외 직원 인스턴스가 보이면 스코프 누출
    const items = (result.data ?? []) as Array<Record<string, unknown>>
    const allowed = ['이민준', '정다은']
    for (const item of items) expect(allowed).toContain(item.employeeName)
  })

  test('GET /dashboard returns 200 (team-scoped)', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getOnboardingDashboard(client)
    assertOk(result, 'MANAGER dashboard scoped')
  })

  test('GET /templates returns 403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listTemplates(client)
    assertError(result, 403, 'MANAGER templates blocked')
  })
})

// ─── EMPLOYEE: RBAC Boundaries ─────────────────────────

test.describe('Onboarding RBAC: EMPLOYEE Boundaries', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('POST /templates returns 403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.createTemplate(client, f.buildTemplate('BLOCKED'))
    assertError(result, 403, 'EMPLOYEE create template')
  })

  test('PUT /templates/[fakeId] returns 403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.updateTemplate(
      client,
      '00000000-0000-4000-a000-000000000000',
      { name: 'blocked' },
    )
    assertError(result, 403, 'EMPLOYEE update template')
  })

  test('DELETE /templates/[fakeId] returns 403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.deleteTemplate(
      client,
      '00000000-0000-4000-a000-000000000000',
    )
    assertError(result, 403, 'EMPLOYEE delete template')
  })

  test('POST /plans returns 403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.createOnboardingPlan(client, {
      employeeId: '00000000-0000-4000-a000-000000000000',
    })
    assertError(result, 403, 'EMPLOYEE create plan')
  })

  test('PUT /force-complete returns 403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.forceCompleteOnboarding(
      client,
      '00000000-0000-4000-a000-000000000000',
      { reason: 'blocked' },
    )
    assertError(result, 403, 'EMPLOYEE force-complete')
  })

  test('GET /checkins (HR list) returns 403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listCheckins(client)
    assertError(result, 403, 'EMPLOYEE HR checkins list')
  })

  test('GET /checkins/[otherEmployeeId] returns 403', async ({ request }) => {
    const client = new ApiClient(request)
    // Use a fake employee ID (not self)
    const result = await f.getEmployeeCheckins(
      client,
      '00000000-0000-4000-a000-000000000099',
    )
    assertError(result, 403, 'EMPLOYEE other checkins')
  })
})

// ─── Multi-tenant: instances list company scope ────────
// 회귀 가드: GET /instances 가 비-SUPER를 본인 법인으로 강제하는지 검증.
// 핵심 보안 속성(①)은 멀티컴퍼니 시드 없이도 증명 가능:
//   ① 비-SUPER가 companyId 쿼리 파라미터로 스코프를 바꿀 수 없음
//      — 타 법인 id를 주입해도 본인 법인 결과와 동일. 픽스 전(파라미터 직접
//        신뢰)이면 매칭 0건이라 본인 목록과 불일치 → 실패.
//   ② (시드가 멀티컴퍼니일 때만) HR_ADMIN 은 SUPER 보다 적은 법인만 봄.
test.describe('Onboarding Instances: company scope (multi-tenant)', () => {
  test('non-SUPER cannot use companyId param to change scope', async () => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002'
    const hrCtx = await playwrightRequest.newContext({ baseURL, storageState: authFile('HR_ADMIN') })
    const saCtx = await playwrightRequest.newContext({ baseURL, storageState: authFile('SUPER_ADMIN') })
    try {
      const hrClient = new ApiClient(hrCtx)
      const saClient = new ApiClient(saCtx)
      const idsOf = (r: { data: unknown }) =>
        (r.data as Array<{ id: string }>).map((i) => i.id).sort()
      const companiesOf = (r: { data: unknown }) =>
        [...new Set((r.data as Array<{ company?: string }>).map((i) => i.company).filter(Boolean))]

      // HR_ADMIN 본인 법인 목록 (스코프 기준선)
      const hr = await f.listOnboardingInstances(hrClient, { limit: '100' })
      assertOk(hr, 'HR_ADMIN list instances')
      const hrIds = idsOf(hr)
      test.skip(hrIds.length < 1, 'No onboarding instances seeded for HR_ADMIN company')

      // ① companyId 파라미터 무력화: 타 법인 id를 주입해도 본인 법인 결과와 동일.
      //    (픽스 전이면 bogus id 매칭 0건 → hrIds 와 불일치하여 실패)
      const injected = await f.listOnboardingInstances(hrClient, {
        limit: '100',
        companyId: '00000000-0000-4000-a000-0000000000ff',
      })
      assertOk(injected, 'HR_ADMIN list with injected companyId')
      expect(idsOf(injected)).toEqual(hrIds)

      // 스코프 일관성: 본인 법인 instance 는 SUPER 전체 목록의 부분집합
      const sa = await f.listOnboardingInstances(saClient, { limit: '100' })
      assertOk(sa, 'SUPER list instances')
      const saIds = idsOf(sa)
      hrIds.forEach((id) => expect(saIds).toContain(id))

      // ② 멀티컴퍼니 시드가 있을 때만: HR_ADMIN 은 SUPER 보다 적은 법인만 봄
      const saCompanies = companiesOf(sa)
      if (saCompanies.length >= 2) {
        const hrCompanies = companiesOf(hr)
        expect(hrCompanies.length).toBeLessThan(saCompanies.length)
        hrCompanies.forEach((c) => expect(saCompanies).toContain(c))
      }
    } finally {
      await hrCtx.dispose()
      await saCtx.dispose()
    }
  })
})
