// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Batch Goal Revision Approve
// Phase C: 배치 수정 제안 일괄 승인
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { eventBus } from '@/lib/events/event-bus'
import { DOMAIN_EVENTS } from '@/lib/events/types'
import { bootstrapEventHandlers } from '@/lib/events/bootstrap'
import type { SessionUser } from '@/types'
import type { GoalRevisionStatus, QuarterlyReviewStatus } from '@/generated/prisma/client'

bootstrapEventHandlers()

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { batchId } = await context.params

    try {
      const result = await prisma.$transaction(async (tx) => {
        const revisions = await tx.goalRevision.findMany({
          where: { batchId, status: 'PENDING' as GoalRevisionStatus, companyId: user.companyId },
          include: {
            goal: { select: { cycleId: true, employeeId: true } },
          },
        })
        if (revisions.length === 0) throw notFound('해당 배치의 승인 대기 수정 제안이 없습니다.')

        // 일괄 승인
        await tx.goalRevision.updateMany({
          where: { batchId, status: 'PENDING' as GoalRevisionStatus },
          data: {
            status: 'APPROVED' as GoalRevisionStatus,
            reviewedById: user.employeeId,
            reviewedAt: new Date(),
          },
        })

        // 각 MboGoal 업데이트 + QGP cascade
        const nonCompletedStatuses: QuarterlyReviewStatus[] = ['DRAFT', 'IN_PROGRESS', 'EMPLOYEE_DONE', 'MANAGER_DONE']

        for (const rev of revisions) {
          await tx.mboGoal.update({
            where: { id: rev.goalId },
            data: {
              title: rev.newTitle,
              description: rev.newDescription,
              weight: rev.newWeight,
              targetMetric: rev.newTargetMetric,
              targetValue: rev.newTargetValue,
            },
          })

          // QGP 조건부 cascade
          const openQGPs = await tx.quarterlyGoalProgress.findMany({
            where: {
              goalId: rev.goalId,
              quarterlyReview: { status: { in: nonCompletedStatuses } },
            },
          })

          for (const qgp of openQGPs) {
            if (qgp.progressPct > 0 || qgp.employeeComment) {
              await tx.quarterlyGoalProgress.update({
                where: { id: qgp.id },
                data: { isRevisedMidQuarter: true },
              })
            } else {
              await tx.quarterlyGoalProgress.update({
                where: { id: qgp.id },
                data: {
                  snapshotTitle: rev.newTitle,
                  snapshotWeight: Number(rev.newWeight),
                  snapshotTarget: rev.newTargetMetric,
                  isRevisedMidQuarter: true,
                },
              })
            }
          }
        }

        return revisions
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.goal.revision.batch-approve',
        resourceType: 'goalRevision',
        resourceId: batchId,
        companyId: user.companyId,
        changes: { batchId, count: result.length, status: 'APPROVED' },
        ip,
        userAgent,
      })

      if (result.length > 0) {
        void eventBus.publish(DOMAIN_EVENTS.GOAL_REVISION_APPROVED, {
          ctx: {
            companyId: user.companyId,
            actorId: user.employeeId,
            occurredAt: new Date(),
          },
          revisionId: result[0].id,
          goalId: result[0].goalId,
          employeeId: result[0].proposedById,
          reviewerId: user.employeeId,
          companyId: user.companyId,
          cycleId: result[0].goal.cycleId,
          decision: 'APPROVED',
          batchId,
        })
      }

      return apiSuccess({ batchId, approvedCount: result.length })
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
