// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Onboarding / Offboarding / Training Test Helpers
// Thin wrappers around ApiClient for onboarding, offboarding,
// and training module tests.
// ═══════════════════════════════════════════════════════════

import { ApiClient, type ApiResult, parseApiResponse } from './api-client'
import type { APIRequestContext } from '@playwright/test'

const OB = '/api/v1/onboarding'
const OFF = '/api/v1/offboarding'
const TR = '/api/v1/training'

// ─── Onboarding: Templates ─────────────────────────────

export function listTemplates(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${OB}/templates`, params)
}

export function createTemplate(
  client: ApiClient,
  data: { name: string; description?: string; targetType: string; companyId?: string },
): Promise<ApiResult> {
  return client.post(`${OB}/templates`, data)
}

export function getTemplate(client: ApiClient, id: string): Promise<ApiResult> {
  return client.get(`${OB}/templates/${id}`)
}

export function updateTemplate(
  client: ApiClient,
  id: string,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  return client.put(`${OB}/templates/${id}`, data)
}

export function deleteTemplate(client: ApiClient, id: string): Promise<ApiResult> {
  return client.del(`${OB}/templates/${id}`)
}

export function listTemplateTasks(
  client: ApiClient,
  templateId: string,
): Promise<ApiResult> {
  return client.get(`${OB}/templates/${templateId}/tasks`)
}

export function createTemplateTask(
  client: ApiClient,
  templateId: string,
  data: {
    title: string
    assigneeType: string
    dueDaysAfter?: number
    isRequired?: boolean
    category?: string
    description?: string
  },
): Promise<ApiResult> {
  return client.post(`${OB}/templates/${templateId}/tasks`, data)
}

export function reorderTemplateTasks(
  client: ApiClient,
  templateId: string,
  data: { taskIds: string[] },
): Promise<ApiResult> {
  return client.put(`${OB}/templates/${templateId}/tasks/reorder`, data)
}

// ─── Onboarding: Instances ─────────────────────────────

export function listOnboardingInstances(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${OB}/instances`, params)
}

export function getOnboardingInstance(
  client: ApiClient,
  id: string,
): Promise<ApiResult> {
  return client.get(`${OB}/instances/${id}`)
}

export function updateOnboardingTaskStatus(
  client: ApiClient,
  instanceId: string,
  taskId: string,
  data: { status: string },
): Promise<ApiResult> {
  return client.put(`${OB}/instances/${instanceId}/tasks/${taskId}/status`, data)
}

export function blockOnboardingTask(
  client: ApiClient,
  instanceId: string,
  taskId: string,
  data: { reason: string },
): Promise<ApiResult> {
  return client.post(`${OB}/instances/${instanceId}/tasks/${taskId}/block`, data)
}

export function unblockOnboardingTask(
  client: ApiClient,
  instanceId: string,
  taskId: string,
): Promise<ApiResult> {
  return client.post(`${OB}/instances/${instanceId}/tasks/${taskId}/unblock`, {})
}

export function signOffOnboarding(
  client: ApiClient,
  instanceId: string,
  data?: Record<string, unknown>,
): Promise<ApiResult> {
  return client.post(`${OB}/instances/${instanceId}/sign-off`, data ?? {})
}

export function getSignOffSummary(
  client: ApiClient,
  instanceId: string,
): Promise<ApiResult> {
  return client.get(`${OB}/instances/${instanceId}/sign-off-summary`)
}

// ─── Onboarding: Misc ──────────────────────────────────

export function getMyOnboarding(client: ApiClient): Promise<ApiResult> {
  return client.get(`${OB}/me`)
}

export function getOnboardingDashboard(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${OB}/dashboard`, params)
}

export function forceCompleteOnboarding(
  client: ApiClient,
  id: string,
  data: { reason?: string },
): Promise<ApiResult> {
  return client.put(`${OB}/${id}/force-complete`, data)
}

export function completeOnboardingTask(
  client: ApiClient,
  taskId: string,
): Promise<ApiResult> {
  return client.put(`${OB}/tasks/${taskId}/complete`, {})
}

export function triggerCrossboarding(
  client: ApiClient,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  return client.post(`${OB}/crossboarding`, data)
}

// ─── Onboarding: Checkins ──────────────────────────────

export function submitCheckin(
  client: ApiClient,
  data: {
    checkinWeek: number
    mood: string
    energy: number
    belonging: number
    comment?: string
  },
): Promise<ApiResult> {
  return client.post(`${OB}/checkin`, data)
}

export function listCheckins(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${OB}/checkins`, params)
}

export function getEmployeeCheckins(
  client: ApiClient,
  employeeId: string,
): Promise<ApiResult> {
  return client.get(`${OB}/checkins/${employeeId}`)
}

// ─── Onboarding: Plans ─────────────────────────────────

export function createOnboardingPlan(
  client: ApiClient,
  data: { employeeId: string; templateId?: string },
): Promise<ApiResult> {
  return client.post(`${OB}/plans`, data)
}

// ─── Offboarding: Checklists ───────────────────────────

export function listChecklists(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${OFF}/checklists`, params)
}

export function createChecklist(
  client: ApiClient,
  data: { name: string; description?: string; targetType?: string; companyId?: string },
): Promise<ApiResult> {
  return client.post(`${OFF}/checklists`, data)
}

export function getChecklist(client: ApiClient, id: string): Promise<ApiResult> {
  return client.get(`${OFF}/checklists/${id}`)
}

export function updateChecklist(
  client: ApiClient,
  id: string,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  return client.put(`${OFF}/checklists/${id}`, data)
}

export function deleteChecklist(client: ApiClient, id: string): Promise<ApiResult> {
  return client.del(`${OFF}/checklists/${id}`)
}

export function listChecklistTasks(
  client: ApiClient,
  checklistId: string,
): Promise<ApiResult> {
  return client.get(`${OFF}/checklists/${checklistId}/tasks`)
}

export function createChecklistTask(
  client: ApiClient,
  checklistId: string,
  data: {
    title: string
    assigneeType: string
    dueDaysBefore?: number
    isRequired?: boolean
    description?: string
  },
): Promise<ApiResult> {
  return client.post(`${OFF}/checklists/${checklistId}/tasks`, data)
}

// ─── Offboarding: Instances ────────────────────────────

export function listOffboardingInstances(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${OFF}/instances`, params)
}

export function getOffboardingInstance(
  client: ApiClient,
  id: string,
): Promise<ApiResult> {
  return client.get(`${OFF}/instances/${id}`)
}

export async function patchOffboardingInstance(
  request: APIRequestContext,
  id: string,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  const resp = await request.fetch(`${OFF}/instances/${id}`, {
    method: 'PATCH',
    data,
  })
  return parseApiResponse(resp)
}

export function completeOffboarding(
  client: ApiClient,
  id: string,
): Promise<ApiResult> {
  return client.post(`${OFF}/instances/${id}/complete`, {})
}

export function rescheduleOffboarding(
  client: ApiClient,
  id: string,
  data: { lastWorkingDate: string; reason?: string },
): Promise<ApiResult> {
  return client.put(`${OFF}/instances/${id}/reschedule`, data)
}

export function listOffboardingDocuments(
  client: ApiClient,
  instanceId: string,
): Promise<ApiResult> {
  return client.get(`${OFF}/instances/${instanceId}/documents`)
}

export function createOffboardingDocument(
  client: ApiClient,
  instanceId: string,
  data: { type: string; fileName: string; fileKey: string; notes?: string },
): Promise<ApiResult> {
  return client.post(`${OFF}/instances/${instanceId}/documents`, data)
}

export function updateOffboardingTaskStatus(
  client: ApiClient,
  instanceId: string,
  taskId: string,
  data: { status: string },
): Promise<ApiResult> {
  return client.put(`${OFF}/instances/${instanceId}/tasks/${taskId}/status`, data)
}

// ─── Offboarding: Misc ────────────────────────────────

export function getMyOffboarding(client: ApiClient): Promise<ApiResult> {
  return client.get(`${OFF}/me`)
}

export function getOffboardingDashboard(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${OFF}/dashboard`, params)
}

export function cancelOffboarding(
  client: ApiClient,
  id: string,
): Promise<ApiResult> {
  return client.put(`${OFF}/${id}/cancel`, {})
}

export function completeOffboardingTask(
  client: ApiClient,
  id: string,
  taskId: string,
): Promise<ApiResult> {
  return client.put(`${OFF}/${id}/tasks/${taskId}/complete`, {})
}

// ─── Offboarding: Exit Interviews ─────────────────────

export function getExitInterview(
  client: ApiClient,
  offboardingId: string,
): Promise<ApiResult> {
  return client.get(`${OFF}/${offboardingId}/exit-interview`)
}

export function createExitInterview(
  client: ApiClient,
  offboardingId: string,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  return client.post(`${OFF}/${offboardingId}/exit-interview`, data)
}

export function getExitInterviewStatistics(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${OFF}/exit-interviews/statistics`, params)
}

// ─── Training: Courses ─────────────────────────────────

export function listCourses(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${TR}/courses`, params)
}

export function createCourse(
  client: ApiClient,
  data: {
    title: string
    category: string
    description?: string
    isMandatory?: boolean
    durationHours?: number
    provider?: string
  },
): Promise<ApiResult> {
  return client.post(`${TR}/courses`, data)
}

export function getCourse(client: ApiClient, id: string): Promise<ApiResult> {
  return client.get(`${TR}/courses/${id}`)
}

export function updateCourse(
  client: ApiClient,
  id: string,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  return client.put(`${TR}/courses/${id}`, data)
}

export function deleteCourse(client: ApiClient, id: string): Promise<ApiResult> {
  return client.del(`${TR}/courses/${id}`)
}

// ─── Training: Enrollments ─────────────────────────────

export function listEnrollments(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${TR}/enrollments`, params)
}

export function createEnrollments(
  client: ApiClient,
  data: { courseId: string; employeeIds: string[] },
): Promise<ApiResult> {
  return client.post(`${TR}/enrollments`, data)
}

export function updateEnrollment(
  client: ApiClient,
  id: string,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  return client.put(`${TR}/enrollments/${id}`, data)
}

// ─── Training: Mandatory Config ────────────────────────

export function listMandatoryConfig(
  client: ApiClient,
): Promise<ApiResult> {
  return client.get(`${TR}/mandatory-config`)
}

export function createMandatoryConfig(
  client: ApiClient,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  return client.post(`${TR}/mandatory-config`, data)
}

export async function patchMandatoryConfig(
  request: APIRequestContext,
  id: string,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  const resp = await request.fetch(`${TR}/mandatory-config/${id}`, {
    method: 'PATCH',
    data,
  })
  return parseApiResponse(resp)
}

export function deleteMandatoryConfig(
  client: ApiClient,
  id: string,
): Promise<ApiResult> {
  return client.del(`${TR}/mandatory-config/${id}`)
}

export function triggerMandatoryEnroll(
  client: ApiClient,
  data: Record<string, unknown>,
): Promise<ApiResult> {
  return client.post(`${TR}/mandatory-config/enroll`, data)
}

// ─── Training: Dashboard / Self-service ────────────────

export function getTrainingDashboard(
  client: ApiClient,
): Promise<ApiResult> {
  return client.get(`${TR}/dashboard`)
}

export function getMandatoryStatus(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${TR}/mandatory-status`, params)
}

export function getMyTraining(client: ApiClient): Promise<ApiResult> {
  return client.get(`${TR}/my`)
}

export function getRecommendations(
  client: ApiClient,
  params?: Record<string, string>,
): Promise<ApiResult> {
  return client.get(`${TR}/recommendations`, params)
}

export function getSkillAssessments(client: ApiClient): Promise<ApiResult> {
  return client.get(`${TR}/skill-assessments`)
}

export function upsertSkillAssessment(
  client: ApiClient,
  data: { competencyId: string; currentLevel: number; targetLevel?: number; notes?: string },
): Promise<ApiResult> {
  return client.post(`${TR}/skill-assessments`, data)
}

// ═══════════════════════════════════════════════════════════
// Seed Data Resolution
// ═══════════════════════════════════════════════════════════

/** Find first IN_PROGRESS onboarding instance from seed */
export async function resolveSeedOnboardingInstance(client: ApiClient) {
  const res = await listOnboardingInstances(client, { status: 'IN_PROGRESS', limit: '5' })
  const items = res.data as Array<Record<string, unknown>> | undefined
  if (!items?.length) throw new Error('No IN_PROGRESS seed onboarding instances found')
  const inst = items[0]
  // Also fetch detail to get tasks
  const detail = await getOnboardingInstance(client, inst.id as string)
  const detailData = detail.data as Record<string, unknown> | undefined
  const tasks = (detailData?.onboardingTasks ?? detailData?.tasks ?? []) as Array<Record<string, unknown>>
  return {
    instanceId: inst.id as string,
    employeeId: (inst.employeeId ?? (inst.employee as Record<string, unknown>)?.id) as string,
    tasks,
  }
}

/** Find first IN_PROGRESS offboarding instance from seed */
export async function resolveSeedOffboardingInstance(client: ApiClient) {
  const res = await listOffboardingInstances(client, { status: 'IN_PROGRESS', limit: '5' })
  const items = res.data as Array<Record<string, unknown>> | undefined
  if (!items?.length) throw new Error('No IN_PROGRESS seed offboarding instances found')
  const inst = items[0]
  const detail = await getOffboardingInstance(client, inst.id as string)
  const detailData = detail.data as Record<string, unknown> | undefined
  const tasks = (detailData?.offboardingTasks ?? detailData?.tasks ?? []) as Array<Record<string, unknown>>
  return {
    instanceId: inst.id as string,
    employeeId: (inst.employeeId ?? (inst.employee as Record<string, unknown>)?.id) as string,
    tasks,
  }
}

/** Find first seed training course */
export async function resolveSeedCourse(client: ApiClient) {
  const res = await listCourses(client, { limit: '5' })
  const items = res.data as Array<Record<string, unknown>> | undefined
  if (!items?.length) throw new Error('No seed training courses found')
  return { courseId: items[0].id as string, title: items[0].title as string }
}

// ═══════════════════════════════════════════════════════════
// Test Data Builders
// ═══════════════════════════════════════════════════════════

const ts = () => Date.now() % 100000

export function buildTemplate(prefix: string) {
  return {
    name: `E2E ${prefix} Template ${ts()}`,
    description: `E2E onboarding template (${prefix})`,
    targetType: 'NEW_HIRE' as const,
  }
}

export function buildTemplateTask(prefix: string) {
  return {
    title: `E2E Task ${prefix} ${ts()}`,
    assigneeType: 'HR' as const,
    dueDaysAfter: 7,
    isRequired: true,
    category: 'SETUP' as const,
    description: `E2E task description (${prefix})`,
  }
}

export function buildChecklist(prefix: string) {
  return {
    name: `E2E ${prefix} Checklist ${ts()}`,
    targetType: 'VOLUNTARY' as const,
  }
}

export function buildChecklistTask(prefix: string) {
  return {
    title: `E2E OB Task ${prefix} ${ts()}`,
    assigneeType: 'HR' as const,
    dueDaysBefore: 14,
    isRequired: true,
    description: `E2E offboarding task (${prefix})`,
  }
}

export function buildCourse(prefix: string) {
  return {
    title: `E2E Course ${prefix} ${ts()}`,
    category: 'TECHNICAL' as const,
    description: `E2E training course (${prefix})`,
    isMandatory: false,
    durationHours: 4,
  }
}

export function buildExitInterview() {
  return {
    interviewDate: new Date().toISOString(), // z.string().datetime()
    primaryReason: 'CAREER_GROWTH' as const,
    satisfactionScore: 3,
    satisfactionDetail: {
      overall: 3,
      compensation: 3,
      culture: 4,
      management: 3,
      growth: 2,
    },
    feedbackText: 'E2E test exit interview feedback',
    wouldRecommend: false,
  }
}

export function buildDocument(prefix: string) {
  return {
    type: 'HANDOVER' as const,
    fileName: `e2e-${prefix}-${ts()}.pdf`,
    fileKey: `offboarding/docs/e2e-${prefix}-${ts()}.pdf`,
    notes: `E2E document (${prefix})`,
  }
}

export function buildCheckin(week: number) {
  return {
    checkinWeek: week,
    mood: 'GOOD' as const,
    energy: 4,
    belonging: 4,
    comment: `E2E checkin week ${week}`,
  }
}
