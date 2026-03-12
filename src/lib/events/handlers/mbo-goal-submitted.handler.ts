// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PERFORMANCE_MBO_GOAL_SUBMITTED Handler
// src/lib/events/handlers/mbo-goal-submitted.handler.ts
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: MBO goal submission notification chain
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════
//
// 트리거: PERFORMANCE_MBO_GOAL_SUBMITTED 이벤트
//         (PUT /api/v1/performance/goals/[id]/submit 직후 fire-and-forget)
//
// Side-effects:
//   1. [CK] 직원의 포지션 기반 매니저 조회
//   2. [ASYNC] 매니저에게 Notification ('performance_mbo_goal_submitted')
//      - 매니저를 찾을 수 없으면 warn 로그 후 종료
//
// 설계 참고:
//   - getManagerByPosition(positionId) — src/lib/assignments.ts
//   - EmployeeAssignment.positionId → Position.reportsTo → 매니저 employeeId
//   - sendNotification() — src/lib/notifications.ts
//
// 중요: fire-and-forget. 실패가 MBO 제출 API에 영향 없어야 함.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { sendNotification } from '@/lib/notifications'
import { getManagerByPosition } from '@/lib/assignments'
import type {
  DomainEventHandler,
  PerformanceMboGoalSubmittedPayload,
  TxClient,
} from '../types'
import { DOMAIN_EVENTS } from '../types'

export const mboGoalSubmittedHandler: DomainEventHandler<'PERFORMANCE_MBO_GOAL_SUBMITTED'> = {
  eventName: DOMAIN_EVENTS.PERFORMANCE_MBO_GOAL_SUBMITTED,

  async handle(payload: PerformanceMboGoalSubmittedPayload, _tx?: TxClient): Promise<void> {
    try {
      // ── 1. 직원 정보 + 포지션 조회 ─────────────────────────────
      const employee = await prisma.employee.findUnique({
        where: { id: payload.employeeId },
        select: {
          id:   true,
          name: true,
          assignments: {
            where: { isPrimary: true, endDate: null },
            select: { positionId: true },
            take: 1,
          },
        },
      })

      if (!employee) {
        console.warn(
          `[mboGoalSubmittedHandler] Employee not found: ${payload.employeeId}`,
        )
        return
      }

      const employeeName = employee.name
      const positionId   = employee.assignments[0]?.positionId

      // ── 2. 포지션 기반 매니저 조회 ─────────────────────────────
      if (!positionId) {
        // TODO: 포지션이 없는 직원(HQ 임원 등)은 매니저 조회 불가 — 알림 skip
        console.warn(
          `[mboGoalSubmittedHandler] Employee ${payload.employeeId} has no positionId. Skipping manager notification.`,
        )
        return
      }

      const managerInfo = await getManagerByPosition(positionId)

      if (!managerInfo?.managerId) {
        // TODO: 최상위 포지션이거나 reportsTo 미설정 — 알림 skip
        console.warn(
          `[mboGoalSubmittedHandler] No manager found for positionId ${positionId} (employeeId: ${payload.employeeId}). Skipping notification.`,
        )
        return
      }

      // ── 3. 매니저에게 알림 발송 ────────────────────────────────
      sendNotification({
        employeeId:  managerInfo.managerId,
        triggerType: 'performance_mbo_goal_submitted',
        title:       `${employeeName}님이 MBO 목표를 제출했습니다`,
        body:        `${payload.goalCount}개 목표, 총 가중치 ${payload.totalWeight}%`,
        link:        `/performance/team-goals?cycleId=${payload.cycleId}`,
        priority:    'normal',
        companyId:   payload.companyId,
        metadata: {
          employeeId: payload.employeeId,
          cycleId:    payload.cycleId,
          goalCount:  payload.goalCount,
        },
      })

      console.info(
        `[mboGoalSubmittedHandler] Notified manager ${managerInfo.managerId} ` +
        `for employee ${payload.employeeId} (${payload.goalCount} goals, ${payload.totalWeight}%)`,
      )
    } catch (error) {
      // 에러 격리: 알림 실패가 비즈니스 로직에 영향 없어야 함
      console.error('[mboGoalSubmittedHandler] Unexpected error:', error)
    }
  },
}
