// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Goal Revision Approve
// Phase C: 매니저가 목표 수정 제안 승인
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
    const { id, revisionId } = await context.params

    try {
      const result = await prisma.$transaction(async (tx) => {
        const revision = await tx.goalRevision.findFirst({
          where: { id: revisionId, goalId: id, companyId: user.companyId },
          include: {
            goal: { select: { cycleId: true, employeeId: true } },
          },
        })
        if (!revision) throw notFound('해당 수정 제안을 찾을 수 없습니다.')
        if (revision.status !== ('PENDING' as GoalRevisionStatus)) {
          throw badRequest('승인 대기 상태의 수정 제안만 승인할 수 있습니다.')
        }

        // 1. GoalRevision → APPROVED
        const updated = await tx.goalRevision.update({
          where: { id: revisionId },
          data: {
            status: 'APPROVED' as GoalRevisionStatus,
            reviewedById: user.employeeId,
            reviewedAt: new Date(),
          },
        })

        // 2. MboGoal 값 업데이트
        await tx.mboGoal.update({
          where: { id },
          data: {
            title: revision.newTitle,
            description: revision.newDescription,
            weight: revision.newWeight,
            targetMetric: revision.newTargetMetric,
            targetValue: revision.newTargetValue,
          },
        })

        // 3. QGP 조건부 cascade (non-COMPLETED 리뷰만)
        const nonCompletedStatuses: QuarterlyReviewStatus[] = ['DRAFT', 'IN_PROGRESS', 'EMPLOYEE_DONE', 'MANAGER_DONE']
        const openQGPs = await tx.quarterlyGoalProgress.findMany({
          where: {
            goalId: id,
            quarterlyReview: {
              status: { in: nonCompletedStatuses },
            },
          },
          include: {
            quarterlyReview: { select: { status: true } },
          },
        })

        for (const qgp of openQGPs) {
          if (qgp.progressPct > 0 || qgp.employeeComment) {
            // 데이터 오염 방어: 진행률/코멘트 입력된 QGP는 스냅샷 스킵
            await tx.quarterlyGoalProgress.update({
              where: { id: qgp.id },
              data: { isRevisedMidQuarter: true },
            })
          } else {
            // 빈 QGP만 스냅샷 자동 갱신
            await tx.quarterlyGoalProgress.update({
              where: { id: qgp.id },
              data: {
                snapshotTitle: revision.newTitle,
                snapshotWeight: Number(revision.newWeight),
                snapshotTarget: revision.newTargetMetric,
                isRevisedMidQuarter: true,
              },
            })
          }
        }

        // 4. Weight soft warning
        const allGoals = await tx.mboGoal.findMany({
          where: { cycleId: revision.goal.cycleId, employeeId: revision.goal.employeeId, status: 'APPROVED' },
          select: { weight: true },
        })
        const totalWeight = allGoals.reduce((sum, g) => sum + Number(g.weight), 0)
        if (Math.abs(totalWeight - 100) > 0.01) {
          console.warn(`[GoalRevision] Weight sum=${totalWeight}% (!=100%) for employee ${revision.goal.employeeId}, cycle ${revision.goal.cycleId}`)
        }

        return { updated, revision }
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.goal.revision.approve',
        resourceType: 'goalRevision',
        resourceId: revisionId,
        companyId: result.updated.companyId,
        changes: { status: 'APPROVED' },
        ip,
        userAgent,
      })

      void eventBus.publish(DOMAIN_EVENTS.GOAL_REVISION_APPROVED, {
        ctx: {
          companyId: result.updated.companyId,
          actorId: user.employeeId,
          occurredAt: new Date(),
        },
        revisionId,
        goalId: id,
        employeeId: result.revision.proposedById,
        reviewerId: user.employeeId,
        companyId: result.updated.companyId,
        cycleId: result.revision.goal.cycleId,
        decision: 'APPROVED',
      })

      return apiSuccess({
        ...result.updated,
        prevWeight: Number(result.updated.prevWeight),
        newWeight: Number(result.updated.newWeight),
      })
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
