// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PERFORMANCE_MANAGER_EVAL_SUBMITTED Handler
// src/lib/events/handlers/manager-eval-submitted.handler.ts
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: triggers calibration readiness check in performance pipeline
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════
//
// 트리거: PERFORMANCE_MANAGER_EVAL_SUBMITTED 이벤트
//         (POST /api/v1/performance/evaluations/manager, status='SUBMITTED')
//
// Side-effects:
//   1. [ASYNC] 직원(평가 대상)에게 Notification
//      - "매니저 평가가 완료되었습니다"
//      - 점수/블록 정보 노출 금지 (사이클 확정 후 공개)
//   2. [ASYNC] 해당 사이클의 모든 매니저 평가가 완료됐는지 확인
//      - 완료 시: 회사 HR_ADMIN들에게 캘리브레이션 진행 알림
//      - N+1 방지: count 쿼리 2개(SUBMITTED 수 vs active 직원 수)로 처리
//
// 중요: fire-and-forget. 실패가 매니저 평가 제출 API에 영향 없어야 함.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { sendNotification, sendNotifications } from '@/lib/notifications'
import type {
  DomainEventHandler,
  PerformanceManagerEvalSubmittedPayload,
  TxClient,
} from '../types'
import { DOMAIN_EVENTS } from '../types'
// FIX: Issue #1 — Import shared HR_ADMIN lookup utility
import { getHrAndSuperAdminIds } from '@/lib/auth/hr-admin-lookup'

export const managerEvalSubmittedHandler: DomainEventHandler<'PERFORMANCE_MANAGER_EVAL_SUBMITTED'> = {
  eventName: DOMAIN_EVENTS.PERFORMANCE_MANAGER_EVAL_SUBMITTED,

  async handle(payload: PerformanceManagerEvalSubmittedPayload, _tx?: TxClient): Promise<void> {
    try {
      // ── 1. 직원에게 평가 완료 알림 발송 ───────────────────────
      // 점수/블록 정보는 사이클 확정(CLOSED) 이후에만 공개 → 알림에 포함 금지
      sendNotification({
        employeeId:  payload.employeeId,
        triggerType: 'performance_manager_eval_submitted',
        title:       '매니저 평가가 완료되었습니다',
        body:        '평가 결과는 사이클 확정 후 확인할 수 있습니다.',
        titleKey:    'notifications.managerEvalSubmitted.title',
        bodyKey:     'notifications.managerEvalSubmitted.body',
        link:        '/performance/results',
        priority:    'normal',
        companyId:   payload.companyId,
        metadata: {
          cycleId:      payload.cycleId,
          evaluationId: payload.evaluationId,
        },
      })

      console.info(
        `[managerEvalSubmittedHandler] Notified employee ${payload.employeeId} ` +
        `of manager eval completion by ${payload.evaluatorId} (cycleId: ${payload.cycleId})`,
      )

      // ── 2. 모든 매니저 평가 완료 여부 체크 ────────────────────
      // 효율적인 count 비교: SUBMITTED MANAGER eval 수 vs 활성 직원 수
      // 단순 비교 — 과도한 N+1 없이 2개 count 쿼리로 처리

      const [submittedCount, activeEmployeeCount] = await Promise.all([
        // 해당 사이클에서 SUBMITTED된 MANAGER 평가 수
        prisma.performanceEvaluation.count({
          where: {
            cycleId:   payload.cycleId,
            companyId: payload.companyId,
            evalType:  'MANAGER',
            status:    'SUBMITTED',
          },
        }),
        // 해당 회사 현재 활성 직원 수 (평가 대상 전체)
        prisma.employeeAssignment.count({
          where: {
            companyId: payload.companyId,
            isPrimary: true,
            endDate:   null,
            status:    'ACTIVE',
          },
        }),
      ])

      // 모든 활성 직원에 대한 매니저 평가 완료 시 HR 알림
      if (activeEmployeeCount > 0 && submittedCount >= activeEmployeeCount) {
        // 사이클 이름 조회 (HR 알림 메시지용)
        const cycle = await prisma.performanceCycle.findUnique({
          where:  { id: payload.cycleId },
          select: { name: true },
        })

        const cycleName = cycle?.name ?? '현재 사이클'

        // FIX: Issue #1 — Use shared HR_ADMIN lookup (RBAC-based, endDate: null)
        //   Previously: queried all employees without role filter (unreliable)
        //   Now: queries EmployeeRole table for HR_ADMIN + SUPER_ADMIN roles
        const hrAdminIds = await getHrAndSuperAdminIds(prisma, payload.companyId)

        if (hrAdminIds.length > 0) {
          const hrNotifications = hrAdminIds.map((hrId) => ({
            employeeId:  hrId,
            triggerType: 'performance_all_evals_complete',
            title:       '모든 매니저 평가가 완료되었습니다',
            body:        `${cycleName} 캘리브레이션을 진행할 수 있습니다.`,
            link:        '/performance/calibration',
            priority:    'high' as const,
            companyId:   payload.companyId,
            metadata: {
              cycleId:        payload.cycleId,
              submittedCount,
              activeEmployeeCount,
            },
          }))

          sendNotifications(hrNotifications)

          console.info(
            `[managerEvalSubmittedHandler] All ${submittedCount}/${activeEmployeeCount} ` +
            `manager evals complete for cycleId ${payload.cycleId}. ` +
            `Notified ${hrAdminIds.length} HR_ADMIN employees.`,
          )
        }
      }
    } catch (error) {
      // 에러 격리: 알림 실패가 비즈니스 로직에 영향 없어야 함
      console.error('[managerEvalSubmittedHandler] Unexpected error:', error)
    }
  },
}
