// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PERFORMANCE_MBO_GOAL_REVIEWED Handler
// src/lib/events/handlers/mbo-goal-reviewed.handler.ts
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: MBO goal approval flow state transition
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════
//
// 트리거: PERFORMANCE_MBO_GOAL_REVIEWED 이벤트
//   - PUT /api/v1/performance/goals/[id]/approve            (decision: APPROVED)
//   - PUT /api/v1/performance/goals/[id]/request-revision   (decision: REVISION_REQUESTED)
//
// Side-effects:
//   1. [ASYNC] 직원(employeeId)에게 Notification
//      - APPROVED:            "MBO 목표가 승인되었습니다"
//      - REVISION_REQUESTED:  "MBO 목표 수정이 요청되었습니다" + 코멘트
//
// 중요: fire-and-forget. 실패가 승인/수정요청 API에 영향 없어야 함.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { sendNotification } from '@/lib/notifications'
import type {
  DomainEventHandler,
  PerformanceMboGoalReviewedPayload,
  TxClient,
} from '../types'
import { DOMAIN_EVENTS } from '../types'

export const mboGoalReviewedHandler: DomainEventHandler<'PERFORMANCE_MBO_GOAL_REVIEWED'> = {
  eventName: DOMAIN_EVENTS.PERFORMANCE_MBO_GOAL_REVIEWED,

  async handle(payload: PerformanceMboGoalReviewedPayload, _tx?: TxClient): Promise<void> {
    try {
      // ── 1. 리뷰어(매니저) 이름 조회 ───────────────────────────
      const reviewer = await prisma.employee.findUnique({
        where: { id: payload.reviewerId },
        select: { name: true },
      })

      const reviewerName = reviewer?.name ?? '매니저'

      // ── 2. 직원에게 알림 발송 ──────────────────────────────────
      const isApproved          = payload.decision === 'APPROVED'
      const triggerType         = isApproved
        ? 'performance_mbo_goal_approved'
        : 'performance_mbo_goal_revision_requested'

      const title               = isApproved
        ? 'MBO 목표가 승인되었습니다'
        : 'MBO 목표 수정이 요청되었습니다'

      const body                = isApproved
        ? `${reviewerName}님이 목표를 승인했습니다.`
        : `${reviewerName}님 코멘트: ${payload.comment ?? '(코멘트 없음)'}`

      const priority: 'normal' | 'high' = isApproved ? 'normal' : 'high'

      sendNotification({
        employeeId:  payload.employeeId,
        triggerType,
        title,
        body,
        link:        `/performance/goals?cycleId=${payload.cycleId}`,
        priority,
        companyId:   payload.companyId,
        metadata: {
          reviewerId: payload.reviewerId,
          decision:   payload.decision,
          goalId:     payload.goalId,
          cycleId:    payload.cycleId,
        },
      })

      console.info(
        `[mboGoalReviewedHandler] Notified employee ${payload.employeeId} ` +
        `— decision: ${payload.decision} by reviewer ${payload.reviewerId}`,
      )
    } catch (error) {
      // 에러 격리: 알림 실패가 비즈니스 로직에 영향 없어야 함
      console.error('[mboGoalReviewedHandler] Unexpected error:', error)
    }
  },
}
