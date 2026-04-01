// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Batch Goal Revision Reject
// Phase C: 배치 수정 제안 일괄 거부
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
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
import type { GoalRevisionStatus } from '@/generated/prisma/client'

bootstrapEventHandlers()

const rejectSchema = z.object({
  comment: z.string().min(1).max(2000),
})

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { batchId } = await context.params
    const body: unknown = await req.json()
    const parsed = rejectSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('거부 사유를 입력해야 합니다.', { issues: parsed.error.issues })
    }

    const revisions = await prisma.goalRevision.findMany({
      where: { batchId, status: 'PENDING' as GoalRevisionStatus, companyId: user.companyId },
      include: { goal: { select: { cycleId: true } } },
    })
    if (revisions.length === 0) throw notFound('해당 배치의 승인 대기 수정 제안이 없습니다.')

    try {
      await prisma.goalRevision.updateMany({
        where: { batchId, status: 'PENDING' as GoalRevisionStatus },
        data: {
          status: 'REJECTED' as GoalRevisionStatus,
          reviewedById: user.employeeId,
          reviewComment: parsed.data.comment,
          reviewedAt: new Date(),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.goal.revision.batch-reject',
        resourceType: 'goalRevision',
        resourceId: batchId,
        companyId: user.companyId,
        changes: { batchId, count: revisions.length, status: 'REJECTED', comment: parsed.data.comment },
        ip,
        userAgent,
      })

      if (revisions.length > 0) {
        void eventBus.publish(DOMAIN_EVENTS.GOAL_REVISION_REJECTED, {
          ctx: {
            companyId: user.companyId,
            actorId: user.employeeId,
            occurredAt: new Date(),
          },
          revisionId: revisions[0].id,
          goalId: revisions[0].goalId,
          employeeId: revisions[0].proposedById,
          reviewerId: user.employeeId,
          companyId: user.companyId,
          cycleId: revisions[0].goal.cycleId,
          decision: 'REJECTED',
          comment: parsed.data.comment,
          batchId,
        })
      }

      return apiSuccess({ batchId, rejectedCount: revisions.length })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
