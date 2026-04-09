// ═══════════════════════════════════════════════════════════
// Phase 2 API P15 — Fixtures
// Training Lifecycle, Pulse Survey Lifecycle, Migration Jobs,
// Locations CRUD + Soft-Delete, Misc (Directory, Sidebar, Departments)
// ═══════════════════════════════════════════════════════════

import { ApiClient, type ApiResult } from './api-client'

const ts = () => Date.now() % 100000

// ─── Training ────────────────────────────────────────────
const TRAINING_COURSES = '/api/v1/training/courses'
const TRAINING_ENROLLMENTS = '/api/v1/training/enrollments'
const TRAINING_MANDATORY = '/api/v1/training/mandatory-config'
const TRAINING_MANDATORY_ENROLL = '/api/v1/training/mandatory-config/enroll'
const TRAINING_DASHBOARD = '/api/v1/training/dashboard'
const TRAINING_MY = '/api/v1/training/my'
const TRAINING_RECOMMENDATIONS = '/api/v1/training/recommendations'
const TRAINING_SKILL_ASSESSMENTS = '/api/v1/training/skill-assessments'

// ─── Pulse ───────────────────────────────────────────────
const PULSE_SURVEYS = '/api/v1/pulse/surveys'
const PULSE_MY_PENDING = '/api/v1/pulse/my-pending'

// ─── Migration ───────────────────────────────────────────
const MIGRATION_JOBS = '/api/v1/migration/jobs'

// ─── Locations ───────────────────────────────────────────
const LOCATIONS = '/api/v1/locations'

// ─── Misc ────────────────────────────────────────────────
const DIRECTORY = '/api/v1/directory'
const SIDEBAR_COUNTS = '/api/v1/sidebar/counts'
const DEPT_HIERARCHY = '/api/v1/departments/hierarchy'

// ═══════════════════════════════════════════════════════════
// Seed resolvers
// ═══════════════════════════════════════════════════════════

let _courseId: string | null = null
let _enrollmentId: string | null = null
let _employeeId: string | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveCourseId(c: ApiClient): Promise<string> {
  if (_courseId) return _courseId
  const res = await c.get(TRAINING_COURSES, { page: '1', limit: '1' })
  _courseId = (res.data as { id: string }[])?.[0]?.id ?? ''
  return _courseId
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveEnrollmentId(c: ApiClient): Promise<string> {
  if (_enrollmentId) return _enrollmentId
  const res = await c.get(TRAINING_ENROLLMENTS, { page: '1', limit: '1' })
  _enrollmentId = (res.data as { id: string }[])?.[0]?.id ?? ''
  return _enrollmentId
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveEmployeeId(c: ApiClient): Promise<string> {
  if (_employeeId) return _employeeId
  const res = await c.get('/api/v1/employees', { page: '1', limit: '1' })
  _employeeId = (res.data as { id: string }[])?.[0]?.id ?? ''
  return _employeeId
}

// ═══════════════════════════════════════════════════════════
// Builders
// ═══════════════════════════════════════════════════════════

export function buildCourse() {
  return {
    title: `E2E Course ${ts()}`,
    description: 'E2E test course description',
    category: 'TECHNICAL',
    isMandatory: false,
    durationHours: 4,
    provider: 'Internal',
  }
}

export function buildCourseUpdate() {
  return {
    description: `Updated description ${ts()}`,
    durationHours: 8,
  }
}

export function buildEnrollment(courseId: string, employeeIds: string[]) {
  return { courseId, employeeIds }
}

export function buildEnrollmentUpdate(status: string) {
  return {
    status,
    ...(status === 'COMPLETED' ? { completedAt: new Date().toISOString(), score: 85 } : {}),
  }
}

export function buildMandatoryConfig(courseId: string) {
  return {
    courseId,
    targetGroup: 'all',
    frequency: 'annual',
    deadlineMonth: 12,
    isActive: true,
  }
}

export function buildMandatoryEnroll() {
  return {
    year: new Date().getFullYear(),
  }
}

export function buildSurvey() {
  const now = new Date()
  const openAt = new Date(now.getTime() - 86400000).toISOString() // yesterday
  const closeAt = new Date(now.getTime() + 7 * 86400000).toISOString() // +7 days
  return {
    title: `E2E Pulse Survey ${ts()}`,
    description: 'E2E test survey',
    targetScope: 'ALL',
    anonymityLevel: 'ANONYMOUS',
    minRespondentsForReport: 3,
    openAt,
    closeAt,
    questions: [
      { questionText: 'How satisfied are you?', questionType: 'LIKERT', sortOrder: 1, isRequired: true },
      { questionText: 'Any feedback?', questionType: 'TEXT', sortOrder: 2, isRequired: false },
    ],
  }
}

export function buildSurveyUpdate() {
  return {
    title: `Updated Survey ${ts()}`,
    description: 'Updated description',
  }
}

export function buildSurveyRespond(questionIds: string[]) {
  return {
    answers: questionIds.map((qId, i) => ({
      questionId: qId,
      answerValue: i === 0 ? '4' : 'E2E feedback text',
    })),
  }
}

export function buildMigrationJob() {
  return {
    name: `E2E Migration ${ts()}`,
    description: 'E2E test migration job',
    sourceType: 'CSV',
    dataScope: 'EMPLOYEE',
  }
}

export function buildMigrationValidate() {
  return {
    data: [
      { name: 'Test User', email: `test${ts()}@e2e.com`, department: 'Engineering' },
    ],
  }
}

export function buildLocation() {
  return {
    code: `LOC-${ts()}`,
    name: `E2E 테스트 사업장 ${ts()}`,
    nameEn: `E2E Test Location ${ts()}`,
    country: 'KR',
    city: 'Seoul',
    timezone: 'Asia/Seoul',
    address: 'E2E Test Address',
    locationType: 'OFFICE',
  }
}

export function buildLocationUpdate() {
  return {
    city: 'Busan',
    address: `Updated address ${ts()}`,
  }
}

// ═══════════════════════════════════════════════════════════
// Wrapper functions
// ═══════════════════════════════════════════════════════════

// --- Training: Courses ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listCourses(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(TRAINING_COURSES, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCourse(c: ApiClient, data: ReturnType<typeof buildCourse>): Promise<ApiResult<any>> {
  return c.post(TRAINING_COURSES, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCourse(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${TRAINING_COURSES}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateCourse(c: ApiClient, id: string, data: ReturnType<typeof buildCourseUpdate>): Promise<ApiResult<any>> {
  return c.put(`${TRAINING_COURSES}/${id}`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deleteCourse(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.del(`${TRAINING_COURSES}/${id}`)
}

// --- Training: Enrollments ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listEnrollments(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(TRAINING_ENROLLMENTS, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createEnrollments(c: ApiClient, data: ReturnType<typeof buildEnrollment>): Promise<ApiResult<any>> {
  return c.post(TRAINING_ENROLLMENTS, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateEnrollment(c: ApiClient, id: string, data: ReturnType<typeof buildEnrollmentUpdate>): Promise<ApiResult<any>> {
  return c.put(`${TRAINING_ENROLLMENTS}/${id}`, data)
}

// --- Training: Mandatory Config ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listMandatoryConfig(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(TRAINING_MANDATORY)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMandatoryConfig(c: ApiClient, data: ReturnType<typeof buildMandatoryConfig>): Promise<ApiResult<any>> {
  return c.post(TRAINING_MANDATORY, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateMandatoryConfig(c: ApiClient, id: string, data: Record<string, unknown>): Promise<ApiResult<any>> {
  return c.patch(`${TRAINING_MANDATORY}/${id}`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deleteMandatoryConfig(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.del(`${TRAINING_MANDATORY}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function triggerMandatoryEnroll(c: ApiClient, data: ReturnType<typeof buildMandatoryEnroll>): Promise<ApiResult<any>> {
  return c.post(TRAINING_MANDATORY_ENROLL, data)
}

// --- Training: Dashboard + Self-service ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTrainingDashboard(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(TRAINING_DASHBOARD)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMyTraining(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(TRAINING_MY)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTrainingRecommendations(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(TRAINING_RECOMMENDATIONS, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listSkillAssessments(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(TRAINING_SKILL_ASSESSMENTS)
}

// --- Pulse: Surveys ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listSurveys(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(PULSE_SURVEYS, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSurvey(c: ApiClient, data: ReturnType<typeof buildSurvey>): Promise<ApiResult<any>> {
  return c.post(PULSE_SURVEYS, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSurvey(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${PULSE_SURVEYS}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateSurvey(c: ApiClient, id: string, data: ReturnType<typeof buildSurveyUpdate>): Promise<ApiResult<any>> {
  return c.put(`${PULSE_SURVEYS}/${id}`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deleteSurvey(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.del(`${PULSE_SURVEYS}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSurveyQuestions(c: ApiClient, surveyId: string): Promise<ApiResult<any>> {
  return c.get(`${PULSE_SURVEYS}/${surveyId}/questions`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function respondSurvey(c: ApiClient, surveyId: string, data: ReturnType<typeof buildSurveyRespond>): Promise<ApiResult<any>> {
  return c.post(`${PULSE_SURVEYS}/${surveyId}/respond`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSurveyResults(c: ApiClient, surveyId: string): Promise<ApiResult<any>> {
  return c.get(`${PULSE_SURVEYS}/${surveyId}/results`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMyPendingSurveys(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(PULSE_MY_PENDING)
}

// --- Migration ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listMigrationJobs(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(MIGRATION_JOBS, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMigrationJob(c: ApiClient, data: ReturnType<typeof buildMigrationJob>): Promise<ApiResult<any>> {
  return c.post(MIGRATION_JOBS, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMigrationJob(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${MIGRATION_JOBS}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deleteMigrationJob(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.del(`${MIGRATION_JOBS}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateMigrationJob(c: ApiClient, id: string, data: ReturnType<typeof buildMigrationValidate>): Promise<ApiResult<any>> {
  return c.post(`${MIGRATION_JOBS}/${id}/validate`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function executeMigrationJob(c: ApiClient, id: string, data: ReturnType<typeof buildMigrationValidate>): Promise<ApiResult<any>> {
  return c.post(`${MIGRATION_JOBS}/${id}/execute`, data)
}

// --- Locations ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listLocations(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(LOCATIONS, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLocation(c: ApiClient, data: ReturnType<typeof buildLocation>): Promise<ApiResult<any>> {
  return c.post(LOCATIONS, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getLocation(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${LOCATIONS}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateLocation(c: ApiClient, id: string, data: ReturnType<typeof buildLocationUpdate>): Promise<ApiResult<any>> {
  return c.put(`${LOCATIONS}/${id}`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deleteLocation(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.del(`${LOCATIONS}/${id}`)
}

// --- Misc ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDirectory(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(DIRECTORY, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSidebarCounts(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(SIDEBAR_COUNTS)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDeptHierarchy(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(DEPT_HIERARCHY, params)
}
