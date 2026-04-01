// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GOAL_REVISION_PROPOSED Handler
// Phase C: 직원이 목표 수정을 제안 → 매니저에게 알림
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { sendNotification } from '@/lib/notifications'
import { getDirectReportIds } from '@/lib/employee/direct-reports'
import type { DomainEventHandler, GoalRevisionProposedPayload, TxClient } from '../types'
import { DOMAIN_EVENTS } from '../types'

export const goalRevisionProposedHandler: DomainEventHandler<'GOAL_REVISION_PROPOSED'> = {
  eventName: DOMAIN_EVENTS.GOAL_REVISION_PROPOSED,

  async handle(payload: GoalRevisionProposedPayload, _tx?: TxClient): Promise<void> {
    try {
      // 직원 이름 조회
      const employee = await prisma.employee.findUnique({
        where: { id: payload.employeeId },
        select: { name: true },
      })
      const employeeName = employee?.name ?? '직원'

      // 매니저 찾기: position hierarchy 기반
      const goal = await prisma.mboGoal.findUnique({
        where: { id: payload.goalId },
        select: {
          employee: {
            select: {
              assignments: {
                where: { endDate: null },
                select: {
                  position: {
                    select: {
                      reportsToPositionId: true,
                      reportsToPosition: {
                        select: {
                          assignments: {
                            where: { endDate: null, isPrimary: true },
                            select: { employeeId: true },
                            take: 1,
                          },
                        },
                      },
                    },
                  },
                },
                take: 1,
                orderBy: { effectiveDate: 'desc' },
              },
            },
          },
        },
      })

      const managerId = goal?.employee?.assignments?.[0]?.position?.reportsToPosition?.assignments?.[0]?.employeeId

      if (managerId) {
        const batchLabel = payload.batchId ? ' (배치 수정)' : ''
        sendNotification({
          employeeId: managerId,
          triggerType: 'performance_goal_revision_proposed',
          title: `MBO 목표 수정 제안${batchLabel}`,
          body: `${employeeName}님이 목표 수정을 제안했습니다: ${payload.reason}`,
          titleKey: 'notifications.goalRevisionProposed.title',
          bodyKey: 'notifications.goalRevisionProposed.body',
          bodyParams: { employeeName, reason: payload.reason },
          link: `/performance/goals?cycleId=${payload.cycleId}`,
          priority: 'normal',
          companyId: payload.companyId,
          metadata: {
            revisionId: payload.revisionId,
            goalId: payload.goalId,
            employeeId: payload.employeeId,
            batchId: payload.batchId,
          },
        })
      }

      console.info(
        `[goalRevisionProposedHandler] Notified manager for revision ${payload.revisionId} ` +
        `by employee ${payload.employeeId}`,
      )
    } catch (error) {
      console.error('[goalRevisionProposedHandler] Unexpected error:', error)
    }
  },
}
