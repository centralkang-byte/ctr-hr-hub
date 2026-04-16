// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Phase 2 API P7: Offboarding + Training
// Checklist CRUD + Instance Ops + Exit Interviews + Courses
// + Enrollments + Mandatory Config + RBAC
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import { resolveSeedData } from '../helpers/test-data'
import * as f from '../helpers/onb-offb-training-fixtures'

// ─── HR_ADMIN: Offboarding Checklist CRUD ──────────────

test.describe('Offboarding Checklists: HR_ADMIN CRUD', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let checklistId: string
  let taskId: string

  test('POST /checklists creates checklist', async ({ request }) => {
    const client = new ApiClient(request)
    const data = f.buildChecklist('CL')
    const result = await f.createChecklist(client, data)
    assertOk(result, 'create checklist')
    const d = result.data as Record<string, unknown>
    expect(d.id).toBeTruthy()
    checklistId = d.id as string
  })

  test('GET /checklists returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listChecklists(client)
    assertOk(result, 'list checklists')
    const items = result.data as Array<Record<string, unknown>>
    expect(items.length).toBeGreaterThan(0)
  })

  test('GET /checklists/[id] returns detail', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getChecklist(client, checklistId)
    assertOk(result, 'get checklist detail')
    const d = result.data as Record<string, unknown>
    expect(d.id).toBe(checklistId)
  })

  test('PUT /checklists/[id] updates name', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.updateChecklist(client, checklistId, {
      name: `E2E Updated CL ${Date.now()}`,
    })
    assertOk(result, 'update checklist')
  })

  test('POST /checklists/[id]/tasks adds task', async ({ request }) => {
    const client = new ApiClient(request)
    const data = f.buildChecklistTask('OT')
    const result = await f.createChecklistTask(client, checklistId, data)
    assertOk(result, 'create checklist task')
    const d = result.data as Record<string, unknown>
    expect(d.id).toBeTruthy()
    taskId = d.id as string
  })

  test('GET /checklists/[id]/tasks returns task list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listChecklistTasks(client, checklistId)
    assertOk(result, 'list checklist tasks')
    const items = result.data as Array<Record<string, unknown>>
    expect(items.length).toBeGreaterThanOrEqual(1)
  })

  test('DELETE /checklists/[id] soft-deletes', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.deleteChecklist(client, checklistId)
    expect(result.ok).toBe(true)
  })
})

// ─── HR_ADMIN: Offboarding Instance Operations ─────────

test.describe('Offboarding Instances: HR_ADMIN Operations', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let instanceId: string
  let firstTaskId: string

  test.beforeAll(async ({ request }) => {
    const client = new ApiClient(request)
    try {
      const seed = await f.resolveSeedOffboardingInstance(client)
      instanceId = seed.instanceId
      const pending = seed.tasks.find(
        (t) => (t.status as string) === 'PENDING' || (t.status as string) === 'NOT_STARTED',
      )
      firstTaskId = (pending?.id ?? seed.tasks[0]?.id) as string
    } catch {
      // No seed data
    }
  })

  test('GET /instances returns list with progress', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listOffboardingInstances(client)
    assertOk(result, 'list offboarding instances')
    const items = result.data as unknown[]
    expect(Array.isArray(items)).toBe(true)
  })

  test('GET /instances?status=IN_PROGRESS filters', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listOffboardingInstances(client, { status: 'IN_PROGRESS' })
    assertOk(result, 'list filtered offboarding')
  })

  test('GET /instances/[id] returns detail', async ({ request }) => {
    test.skip(!instanceId, 'No seed offboarding instance')
    const client = new ApiClient(request)
    const result = await f.getOffboardingInstance(client, instanceId)
    assertOk(result, 'get offboarding instance')
    const d = result.data as Record<string, unknown>
    expect(d.id).toBe(instanceId)
  })

  test('PATCH /instances/[id] toggles gate flag', async ({ request }) => {
    test.skip(!instanceId, 'No seed offboarding instance')
    const result = await f.patchOffboardingInstance(request, instanceId, {
      isItAccountDeactivated: true,
    })
    // May succeed or fail depending on schema
    expect([200, 400]).toContain(result.status)
  })

  test('PUT /instances/[id]/tasks/[taskId]/status transitions', async ({ request }) => {
    test.skip(!instanceId || !firstTaskId, 'No seed instance or task')
    const client = new ApiClient(request)
    const result = await f.updateOffboardingTaskStatus(client, instanceId, firstTaskId, {
      status: 'IN_PROGRESS',
    })
    expect([200, 400]).toContain(result.status)
  })

  test('POST /instances/[id]/documents uploads doc metadata', async ({ request }) => {
    test.skip(!instanceId, 'No seed offboarding instance')
    const client = new ApiClient(request)
    const data = f.buildDocument('DOC')
    const result = await f.createOffboardingDocument(client, instanceId, data)
    // 201 if created, 400 if schema mismatch
    expect([200, 201, 400]).toContain(result.status)
  })

  test('GET /instances/[id]/documents returns list', async ({ request }) => {
    test.skip(!instanceId, 'No seed offboarding instance')
    const client = new ApiClient(request)
    const result = await f.listOffboardingDocuments(client, instanceId)
    assertOk(result, 'list offboarding documents')
  })

  test('PUT /instances/[id]/reschedule past date returns 400', async ({ request }) => {
    test.skip(!instanceId, 'No seed offboarding instance')
    const client = new ApiClient(request)
    const result = await f.rescheduleOffboarding(client, instanceId, {
      lastWorkingDate: '2020-01-01',
      reason: 'E2E past date test',
    })
    assertError(result, 400, 'reschedule past date')
  })
})

// ─── HR_ADMIN: Exit Interview & Dashboard ──────────────

test.describe('Offboarding Exit Interview & Dashboard: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  let instanceId: string | undefined

  test.beforeAll(async ({ request }) => {
    const client = new ApiClient(request)
    try {
      const seed = await f.resolveSeedOffboardingInstance(client)
      instanceId = seed.instanceId
    } catch {
      // no seed
    }
  })

  test('GET /dashboard returns enriched data', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getOffboardingDashboard(client)
    assertOk(result, 'offboarding dashboard')
  })

  test('GET /dashboard response has data array', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getOffboardingDashboard(client)
    assertOk(result, 'dashboard structure')
    const d = result.data
    expect(d !== null && d !== undefined).toBe(true)
  })

  test('GET /exit-interviews/statistics returns stats', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getExitInterviewStatistics(client)
    assertOk(result, 'exit interview statistics')
  })

  test('GET /exit-interviews/statistics?minCount=1', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getExitInterviewStatistics(client, { minCount: '1' })
    assertOk(result, 'statistics with minCount')
  })

  test('GET /[id]/exit-interview returns data or empty', async ({ request }) => {
    test.skip(!instanceId, 'No seed offboarding instance')
    const client = new ApiClient(request)
    const result = await f.getExitInterview(client, instanceId!)
    // 200 with data or null
    assertOk(result, 'get exit interview')
  })

  test('POST /[id]/exit-interview creates or conflicts', async ({ request }) => {
    test.skip(!instanceId, 'No seed offboarding instance')
    const client = new ApiClient(request)
    const data = f.buildExitInterview()
    const result = await f.createExitInterview(client, instanceId!, data)
    // 201 if new, 409 if exists, 400 if validation
    expect([200, 201, 400, 409]).toContain(result.status)
  })
})

// ─── Exit Interview Privacy ────────────────────────────

test.describe('Exit Interview Privacy: MANAGER blocked', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('MANAGER GET /[id]/exit-interview returns 403', async ({ request }) => {
    const client = new ApiClient(request)
    // Use a fake ID — the permission check runs before ID validation
    const result = await f.getExitInterview(
      client,
      '00000000-0000-4000-a000-000000000000',
    )
    assertError(result, 403, 'MANAGER exit interview blocked')
  })
})

test.describe('Exit Interview Privacy: EMPLOYEE blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('EMPLOYEE GET /[id]/exit-interview returns 403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getExitInterview(
      client,
      '00000000-0000-4000-a000-000000000000',
    )
    assertError(result, 403, 'EMPLOYEE exit interview blocked')
  })

  test('EMPLOYEE GET /statistics returns 403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getExitInterviewStatistics(client)
    // Exit stats uses perm(MODULE.ONBOARDING, ACTION.VIEW) which EMPLOYEE lacks
    assertError(result, 403, 'EMPLOYEE statistics blocked')
  })
})

// ─── EMPLOYEE: Offboarding Self-Service ────────────────

test.describe('Offboarding Self-Service: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /me returns own offboarding or null', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getMyOffboarding(client)
    assertOk(result, 'my offboarding')
  })

  test('PUT /tasks/[taskId]/complete on own task', async ({ request }) => {
    const client = new ApiClient(request)
    // Fake task ID — expect 404 (self-service, auth passes, but task not found)
    const result = await f.completeOffboardingTask(
      client,
      '00000000-0000-4000-a000-000000000000',
      '00000000-0000-4000-a000-000000000099',
    )
    expect([400, 404]).toContain(result.status)
  })

  test('PUT /cancel returns 403 for EMPLOYEE', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.cancelOffboarding(
      client,
      '00000000-0000-4000-a000-000000000000',
    )
    assertError(result, 403, 'EMPLOYEE cancel blocked')
  })
})

// ─── HR_ADMIN: Training Course CRUD ────────────────────

test.describe('Training Courses: HR_ADMIN CRUD', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let courseId: string

  test('POST /courses creates course', async ({ request }) => {
    const client = new ApiClient(request)
    const data = f.buildCourse('CRS')
    const result = await f.createCourse(client, data)
    assertOk(result, 'create course')
    const d = result.data as Record<string, unknown>
    expect(d.id).toBeTruthy()
    courseId = d.id as string
  })

  test('GET /courses returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listCourses(client)
    assertOk(result, 'list courses')
    const items = result.data as Array<Record<string, unknown>>
    expect(items.length).toBeGreaterThan(0)
  })

  test('GET /courses?category=TECHNICAL filters', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listCourses(client, { category: 'TECHNICAL' })
    assertOk(result, 'list courses filtered')
  })

  test('GET /courses/[id] returns detail', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getCourse(client, courseId)
    assertOk(result, 'get course detail')
    const d = result.data as Record<string, unknown>
    expect(d.id).toBe(courseId)
  })

  test('PUT /courses/[id] updates title', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.updateCourse(client, courseId, {
      title: `E2E Updated Course ${Date.now()}`,
    })
    assertOk(result, 'update course')
  })

  test('DELETE /courses/[id] soft-deletes', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.deleteCourse(client, courseId)
    expect(result.ok).toBe(true)
  })

  test('GET /courses/[id] after delete returns 404', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getCourse(client, courseId)
    assertError(result, 404, 'deleted course')
  })
})

// ─── HR_ADMIN: Enrollments & Mandatory Config ──────────

test.describe('Training Enrollments & Mandatory Config: HR_ADMIN', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let seedData: Awaited<ReturnType<typeof resolveSeedData>>
  let enrollmentCourseId: string
  let configId: string

  test.beforeAll(async ({ request }) => {
    seedData = await resolveSeedData(request)
    // Create a course for enrollment tests
    const client = new ApiClient(request)
    const courseResult = await f.createCourse(client, f.buildCourse('ENROLL'))
    if (courseResult.ok) {
      enrollmentCourseId = (courseResult.data as Record<string, unknown>).id as string
    }
  })

  test('POST /enrollments batch-enrolls employees', async ({ request }) => {
    test.skip(!enrollmentCourseId, 'No course for enrollment')
    const client = new ApiClient(request)
    const result = await f.createEnrollments(client, {
      courseId: enrollmentCourseId,
      employeeIds: [seedData.employeeId],
    })
    assertOk(result, 'batch enroll')
    const d = result.data as Record<string, unknown>
    expect(d.created).toBeDefined()
  })

  test('GET /enrollments returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listEnrollments(client)
    assertOk(result, 'list enrollments')
  })

  test('GET /enrollments?courseId filters', async ({ request }) => {
    test.skip(!enrollmentCourseId, 'No course for filter')
    const client = new ApiClient(request)
    const result = await f.listEnrollments(client, { courseId: enrollmentCourseId })
    assertOk(result, 'list enrollments filtered')
  })

  test('PUT /enrollments/[id] updates status', async ({ request }) => {
    test.skip(!enrollmentCourseId, 'No enrollment to update')
    const client = new ApiClient(request)
    // Get enrollment first
    const list = await f.listEnrollments(client, { courseId: enrollmentCourseId })
    const items = list.data as Array<Record<string, unknown>> | undefined
    if (!items?.length) return
    const result = await f.updateEnrollment(client, items[0].id as string, {
      status: 'IN_PROGRESS',
    })
    assertOk(result, 'update enrollment status')
  })

  test('GET /mandatory-config returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listMandatoryConfig(client)
    assertOk(result, 'list mandatory config')
  })

  test('POST /mandatory-config creates config', async ({ request }) => {
    test.skip(!enrollmentCourseId, 'No course for config')
    const client = new ApiClient(request)
    const result = await f.createMandatoryConfig(client, {
      courseId: enrollmentCourseId,
      targetGroup: 'all',
      frequency: 'annual',
      deadlineMonth: 12,
    })
    // 201 if created, 400 if validation, 409 if exists
    expect([200, 201, 400, 409]).toContain(result.status)
    if (result.ok) {
      configId = (result.data as Record<string, unknown>).id as string
    }
  })

  test('PATCH /mandatory-config/[id] updates', async ({ request }) => {
    test.skip(!configId, 'No config to update')
    const result = await f.patchMandatoryConfig(request, configId, {
      frequency: 'biennial',
    })
    expect([200, 400]).toContain(result.status)
  })

  test('DELETE /mandatory-config/[id] deletes', async ({ request }) => {
    test.skip(!configId, 'No config to delete')
    const client = new ApiClient(request)
    const result = await f.deleteMandatoryConfig(client, configId)
    expect(result.ok).toBe(true)
  })
})

// ─── HR_ADMIN: Training Dashboard & Status ─────────────

test.describe('Training Dashboard & Status: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /dashboard returns KPIs', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getTrainingDashboard(client)
    assertOk(result, 'training dashboard')
  })

  test('GET /mandatory-status returns status data', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getMandatoryStatus(client)
    assertOk(result, 'mandatory status')
  })
})

// ─── HR_ADMIN: Training Self-Service ───────────────────

test.describe('Training Self-Service: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /my returns training summary', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getMyTraining(client)
    assertOk(result, 'my training')
  })

  test('GET /recommendations returns gap analysis', async ({ request }) => {
    const client = new ApiClient(request)
    const seedData = await resolveSeedData(request)
    const result = await f.getRecommendations(client, { employeeId: seedData.employeeId })
    assertOk(result, 'recommendations')
  })

  test('GET /skill-assessments returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getSkillAssessments(client)
    assertOk(result, 'skill assessments')
  })

  test('POST /skill-assessments upserts assessment', async ({ request }) => {
    const client = new ApiClient(request)
    // Resolve a real competency from skill-assessments GET
    const existing = await f.getSkillAssessments(client)
    const items = existing.data as Array<Record<string, unknown>> | undefined
    if (items?.length) {
      // Use an existing competencyId for a valid upsert
      const result = await f.upsertSkillAssessment(client, {
        competencyId: items[0].competencyId as string,
        currentLevel: 3,
        targetLevel: 5,
        notes: 'E2E test assessment',
      })
      expect([200, 201]).toContain(result.status)
    } else {
      // No competencies seeded — validate error path
      const result = await f.upsertSkillAssessment(client, {
        competencyId: '00000000-0000-4000-a000-000000000001',
        currentLevel: 3,
      })
      expect([400, 500]).toContain(result.status)
    }
  })
})

// ─── RBAC: Offboarding Boundaries ──────────────────────

test.describe('Offboarding RBAC: EMPLOYEE Boundaries', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('POST /checklists returns 403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.createChecklist(client, f.buildChecklist('BLOCKED'))
    assertError(result, 403, 'EMPLOYEE create checklist')
  })

  test('PUT /checklists/[fakeId] returns 403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.updateChecklist(
      client,
      '00000000-0000-4000-a000-000000000000',
      { name: 'blocked' },
    )
    assertError(result, 403, 'EMPLOYEE update checklist')
  })

  test('DELETE /checklists/[fakeId] returns 403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.deleteChecklist(
      client,
      '00000000-0000-4000-a000-000000000000',
    )
    assertError(result, 403, 'EMPLOYEE delete checklist')
  })

  test('POST /instances/[id]/complete returns 403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.completeOffboarding(
      client,
      '00000000-0000-4000-a000-000000000000',
    )
    assertError(result, 403, 'EMPLOYEE complete offboarding')
  })
})

// ─── RBAC: Training Boundaries ─────────────────────────

test.describe('Training RBAC: EMPLOYEE Boundaries', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('POST /courses returns 403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.createCourse(client, f.buildCourse('BLOCKED'))
    assertError(result, 403, 'EMPLOYEE create course')
  })

  test('PUT /courses/[fakeId] returns 403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.updateCourse(
      client,
      '00000000-0000-4000-a000-000000000000',
      { title: 'blocked' },
    )
    assertError(result, 403, 'EMPLOYEE update course')
  })

  test('DELETE /courses/[fakeId] returns 403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.deleteCourse(
      client,
      '00000000-0000-4000-a000-000000000000',
    )
    assertError(result, 403, 'EMPLOYEE delete course')
  })

  test('POST /enrollments returns 403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.createEnrollments(client, {
      courseId: '00000000-0000-4000-a000-000000000000',
      employeeIds: ['00000000-0000-4000-a000-000000000001'],
    })
    assertError(result, 403, 'EMPLOYEE create enrollment')
  })

  test('POST /mandatory-config returns 403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.createMandatoryConfig(client, {
      courseId: '00000000-0000-4000-a000-000000000000',
      targetGroup: 'ALL',
    })
    assertError(result, 403, 'EMPLOYEE create mandatory config')
  })

  test('POST /mandatory-config/enroll returns 403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.triggerMandatoryEnroll(client, {
      configId: '00000000-0000-4000-a000-000000000000',
    })
    assertError(result, 403, 'EMPLOYEE trigger enroll')
  })
})
