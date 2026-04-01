// ═══════════════════════════════════════════════════════════
// CTR HR Hub — QuarterlyReview Role-based Data Masking
// src/lib/performance/quarterly-review-masking.ts
// ═══════════════════════════════════════════════════════════
//
// 마스킹 규칙 (Design Review 확정):
//   EMPLOYEE: COMPLETED 전까지 manager 섹션 null
//   MANAGER:  EMPLOYEE_DONE 전까지 employee 섹션 null
//   HR/SA:    항상 전체 보임
// ═══════════════════════════════════════════════════════════

import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyReview = Record<string, any>

const EMPLOYEE_FIELDS = [
  'goalHighlights',
  'challenges',
  'developmentNeeds',
  'employeeComments',
  'employeeSubmittedAt',
] as const

const MANAGER_FIELDS = [
  'managerFeedback',
  'coachingNotes',
  'developmentPlan',
  'overallSentiment',
  'managerSubmittedAt',
  'actionItems',
  'aiSummary',
] as const

function nullifyFields<T extends AnyReview>(review: T, fields: readonly string[]): T {
  const masked = { ...review }
  for (const field of fields) {
    if (field in masked) {
      masked[field] = null
    }
  }
  return masked
}

function maskGoalProgressForEmployee<T extends AnyReview>(review: T): T {
  if (!review.goalProgress || !Array.isArray(review.goalProgress)) return review
  return {
    ...review,
    goalProgress: review.goalProgress.map((gp: AnyReview) => ({
      ...gp,
      managerComment: null,
      trackingStatus: null,
    })),
  }
}

function maskGoalProgressForManager<T extends AnyReview>(review: T): T {
  if (!review.goalProgress || !Array.isArray(review.goalProgress)) return review
  return {
    ...review,
    goalProgress: review.goalProgress.map((gp: AnyReview) => ({
      ...gp,
      employeeComment: null,
    })),
  }
}

/**
 * 역할 기반 QuarterlyReview 데이터 마스킹.
 * 모든 GET 엔드포인트에서 응답 전 호출.
 */
export function maskQuarterlyReview<T extends AnyReview>(
  review: T,
  user: SessionUser,
): T {
  // HR/SUPER_ADMIN: 전체 볼 수 있음
  if (user.role === ROLE.SUPER_ADMIN || user.role === ROLE.HR_ADMIN) {
    return review
  }

  const isEmployee = user.employeeId === review.employeeId
  const isManager = user.employeeId === review.managerId
  const status = review.status as string

  // EMPLOYEE 시점
  if (isEmployee) {
    // COMPLETED: 전체 보임
    if (status === 'COMPLETED') return review

    // COMPLETED 전: manager 섹션 null + QGP manager 필드 null
    let masked = nullifyFields(review, MANAGER_FIELDS as unknown as string[])
    masked = maskGoalProgressForEmployee(masked)
    return masked
  }

  // MANAGER 시점
  if (isManager) {
    // EMPLOYEE_DONE 이상: 전체 보임
    if (['EMPLOYEE_DONE', 'MANAGER_DONE', 'COMPLETED'].includes(status)) {
      return review
    }

    // EMPLOYEE_DONE 전: employee 섹션 null + QGP employee 필드 null
    let masked = nullifyFields(review, EMPLOYEE_FIELDS as unknown as string[])
    masked = maskGoalProgressForManager(masked)
    return masked
  }

  // EXECUTIVE: 전체 읽기 (조직 리더)
  if (user.role === 'EXECUTIVE') return review

  // 그 외: 모든 민감 필드 null
  let masked = nullifyFields(review, [...EMPLOYEE_FIELDS, ...MANAGER_FIELDS] as unknown as string[])
  masked = maskGoalProgressForEmployee(masked)
  masked = maskGoalProgressForManager(masked)
  return masked
}
