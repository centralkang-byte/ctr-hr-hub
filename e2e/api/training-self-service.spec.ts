// ═══════════════════════════════════════════════════════════
// Training Self-Service — EMPLOYEE
// POST /api/v1/training/my/enrollments (self-enroll)
// PUT  /api/v1/training/my/enrollments/[id] (status transition)
// 런칭 감사 P0 수정 검증: 직원 수강 신청→시작→완료 end-to-end
// ═══════════════════════════════════════════════════════════

import { test, expect, request as playwrightRequest } from '@playwright/test'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'

const MY_ENROLLMENTS = '/api/v1/training/my/enrollments'
const HR_ENROLLMENTS = '/api/v1/training/enrollments'
const COURSES = '/api/v1/training/courses'

test.describe('Training Self-Service: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })
  test.describe.configure({ mode: 'serial' })

  let courseId = ''
  let enrollmentId = ''

  test.beforeAll(async () => {
    // 과정은 HR_ADMIN 컨텍스트로 준비 (셀프서비스 신청 대상)
    const hrCtx = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    const hr = new ApiClient(hrCtx)
    const res = await hr.post(COURSES, {
      title: `E2E SelfService Course ${Date.now() % 100000}`,
      description: 'self-service e2e',
      category: 'TECHNICAL',
      isMandatory: false,
      durationHours: 2,
    })
    courseId = (res.data as { id: string })?.id ?? ''
    await hrCtx.dispose()
    expect(courseId).toBeTruthy()
  })

  test('POST self-enroll → 201', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await api.post(MY_ENROLLMENTS, { courseId })
    assertOk(res, 'self enroll')
    enrollmentId = (res.data as { id: string }).id
    expect(enrollmentId).toBeTruthy()
  })

  test('POST duplicate self-enroll → 409', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await api.post(MY_ENROLLMENTS, { courseId })
    assertError(res, 409, 'duplicate enroll rejected')
  })

  test('PUT start course (ENROLLED→IN_PROGRESS) → 200', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await api.put(`${MY_ENROLLMENTS}/${enrollmentId}`, { status: 'IN_PROGRESS' })
    assertOk(res, 'start course')
    expect((res.data as { status: string }).status).toBe('IN_PROGRESS')
  })

  test('PUT complete course (IN_PROGRESS→COMPLETED) → 200, completedAt set by server', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await api.put(`${MY_ENROLLMENTS}/${enrollmentId}`, { status: 'ENROLLMENT_COMPLETED' })
    assertOk(res, 'complete course')
    const data = res.data as { status: string; completedAt: string | null; expiresAt: string | null }
    expect(data.status).toBe('ENROLLMENT_COMPLETED')
    expect(data.completedAt).toBeTruthy()
    // validityMonths 없는 과정 = 무기한 (expiresAt null). validityMonths 케이스는 course
    // create API가 validityMonths를 안 받아 API-only로 재현 불가 — 라우트 로직으로 커버.
    expect(data.expiresAt).toBeNull()
  })

  test('PUT on terminal state (COMPLETED→IN_PROGRESS) → 409', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await api.put(`${MY_ENROLLMENTS}/${enrollmentId}`, { status: 'IN_PROGRESS' })
    assertError(res, 409, 'terminal state transition rejected')
  })

  test('PUT on another employee enrollment → 404 (ownership fail-closed)', async ({ request }) => {
    // HR가 다른 직원(employee 목록 중 본인 아닌 첫 직원)을 같은 과정에 배치 등록
    const hrCtx = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    const hr = new ApiClient(hrCtx)
    const empRes = await hr.get('/api/v1/employees', { page: '1', limit: '5', search: 'employee-b@ctr.co.kr' })
    const employees = (empRes.data as { id: string }[]) ?? []
    const otherId = employees[0]?.id
    let otherEnrollmentId = ''
    if (otherId) {
      await hr.post(HR_ENROLLMENTS, { courseId, employeeIds: [otherId] })
      const listRes = await hr.get(HR_ENROLLMENTS, { courseId, employeeId: otherId })
      otherEnrollmentId = (listRes.data as { id: string }[])?.[0]?.id ?? ''
    }
    await hrCtx.dispose()
    // 보안 회귀 방어 테스트 — setup 실패 시 skip이 아니라 fail (조용한 통과 금지)
    expect(otherEnrollmentId, 'failed to prepare another employee enrollment').toBeTruthy()

    const api = new ApiClient(request)
    const res = await api.put(`${MY_ENROLLMENTS}/${otherEnrollmentId}`, { status: 'IN_PROGRESS' })
    assertError(res, 404, 'cannot touch another employee enrollment')
  })

  test('HR batch endpoint still 403 for EMPLOYEE (regression)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await api.post(HR_ENROLLMENTS, { courseId, employeeIds: ['00000000-0000-0000-0000-000000000000'] })
    assertError(res, 403, 'HR batch endpoint stays gated')
  })
})
