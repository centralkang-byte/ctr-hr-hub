// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GOAL_REVISION_APPROVED / REJECTED Handler
// Phase C: 매니저가 목표 수정 승인/거부 → 직원에게 알림
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { sendNotification } from '@/lib/notifications'
import type { DomainEventHandler, GoalRevisionReviewedPayload, TxClient } from '../types'
import { DOMAIN_EVENTS } from '../types'

// APPROVED 핸들러
export const goalRevisionApprovedHandler: DomainEventHandler<'GOAL_REVISION_APPROVED'> = {
  eventName: DOMAIN_EVENTS.GOAL_REVISION_APPROVED,

  async handle(payload: GoalRevisionReviewedPayload, _tx?: TxClient): Promise<void> {
    try {
      await notifyEmployee(payload)
    } catch (error) {
      console.error('[goalRevisionApprovedHandler] Unexpected error:', error)
    }
  },
}

// REJECTED 핸들러
export const goalRevisionRejectedHandler: DomainEventHandler<'GOAL_REVISION_REJECTED'> = {
  eventName: DOMAIN_EVENTS.GOAL_REVISION_REJECTED,

  async handle(payload: GoalRevisionReviewedPayload, _tx?: TxClient): Promise<void> {
    try {
      await notifyEmployee(payload)
    } catch (error) {
      console.error('[goalRevisionRejectedHandler] Unexpected error:', error)
    }
  },
}

async function notifyEmployee(payload: GoalRevisionReviewedPayload): Promise<void> {
  const reviewer = await prisma.employee.findUnique({
    where: { id: payload.reviewerId },
    select: { name: true },
  })
  const reviewerName = reviewer?.name ?? '매니저'

  const isApproved = payload.decision === 'APPROVED'
  const batchLabel = payload.batchId ? ' (배치)' : ''
  const triggerType = isApproved
    ? 'performance_goal_revision_approved'
    : 'performance_goal_revision_rejected'

  const title = isApproved
    ? `목표 수정이 승인되었습니다${batchLabel}`
    : `목표 수정이 거부되었습니다${batchLabel}`

  const body = isApproved
    ? `${reviewerName}님이 목표 수정을 승인했습니다.`
    : `${reviewerName}님 코멘트: ${payload.comment ?? '(코멘트 없음)'}`

  sendNotification({
    employeeId: payload.employeeId,
    triggerType,
    title,
    body,
    titleKey: isApproved
      ? 'notifications.goalRevisionApproved.title'
      : 'notifications.goalRevisionRejected.title',
    bodyKey: isApproved
      ? 'notifications.goalRevisionApproved.body'
      : 'notifications.goalRevisionRejected.body',
    bodyParams: { reviewerName, comment: payload.comment ?? '' },
    link: `/performance/goals?cycleId=${payload.cycleId}`,
    priority: isApproved ? 'normal' : 'high',
    companyId: payload.companyId,
    metadata: {
      revisionId: payload.revisionId,
      goalId: payload.goalId,
      reviewerId: payload.reviewerId,
      decision: payload.decision,
      batchId: payload.batchId,
    },
  })

  console.info(
    `[goalRevisionReviewedHandler] Notified employee ${payload.employeeId} — ` +
    `decision: ${payload.decision} by reviewer ${payload.reviewerId}`,
  )
}
