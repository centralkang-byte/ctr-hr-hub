// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PERFORMANCE_SELF_EVAL_SUBMITTED Handler
// src/lib/events/handlers/self-eval-submitted.handler.ts
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: triggers manager evaluation notification in performance pipeline
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════
//
// 트리거: PERFORMANCE_SELF_EVAL_SUBMITTED 이벤트
//         (POST /api/v1/performance/evaluations/self, status='SUBMITTED')
//
// Side-effects:
//   1. [CK] 직원의 포지션 기반 매니저 조회 (getManagerByPosition)
//   2. [ASYNC] 매니저에게 Notification — "팀원이 자기평가를 제출했습니다"
//      - 매니저를 찾을 수 없으면 warn 로그 후 종료
//
// 중요: fire-and-forget. 실패가 자기평가 제출 API에 영향 없어야 함.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import { sendNotification } from '@/lib/notifications'
import { getManagerByPosition } from '@/lib/assignments'
import type {
  DomainEventHandler,
  PerformanceSelfEvalSubmittedPayload,
  TxClient,
} from '../types'
import { DOMAIN_EVENTS } from '../types'

export const selfEvalSubmittedHandler: DomainEventHandler<'PERFORMANCE_SELF_EVAL_SUBMITTED'> = {
  eventName: DOMAIN_EVENTS.PERFORMANCE_SELF_EVAL_SUBMITTED,

  async handle(payload: PerformanceSelfEvalSubmittedPayload, _tx?: TxClient): Promise<void> {
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
          `[selfEvalSubmittedHandler] Employee not found: ${payload.employeeId}`,
        )
        return
      }

      const employeeName = employee.name
      const positionId   = extractPrimaryAssignment(employee.assignments)?.positionId

      // ── 2. 포지션 기반 매니저 조회 ─────────────────────────────
      if (!positionId) {
        // TODO: 포지션 없는 직원(최상위 임원 등)은 매니저 조회 불가 → skip
        console.warn(
          `[selfEvalSubmittedHandler] Employee ${payload.employeeId} has no positionId. Skipping manager notification.`,
        )
        return
      }

      const managerInfo = await getManagerByPosition(positionId)

      if (!managerInfo?.managerId) {
        // TODO: 최상위 포지션이거나 reportsTo 미설정 → skip
        console.warn(
          `[selfEvalSubmittedHandler] No manager found for positionId ${positionId}. Skipping notification.`,
        )
        return
      }

      // ── 3. 매니저에게 알림 발송 ────────────────────────────────
      sendNotification({
        employeeId:  managerInfo.managerId,
        triggerType: 'performance_self_eval_submitted',
        title:       `${employeeName}님이 자기평가를 제출했습니다`,
        body:        '성과관리에서 팀원 평가를 진행해주세요.',
        link:        `/performance/evaluations/manager?cycleId=${payload.cycleId}`,
        priority:    'normal',
        companyId:   payload.companyId,
        metadata: {
          employeeId:   payload.employeeId,
          cycleId:      payload.cycleId,
          evaluationId: payload.evaluationId,
        },
      })

      console.info(
        `[selfEvalSubmittedHandler] Notified manager ${managerInfo.managerId} ` +
        `for employee ${payload.employeeId} self-eval submission (cycleId: ${payload.cycleId})`,
      )
    } catch (error) {
      // 에러 격리: 알림 실패가 비즈니스 로직에 영향 없어야 함
      console.error('[selfEvalSubmittedHandler] Unexpected error:', error)
    }
  },
}
