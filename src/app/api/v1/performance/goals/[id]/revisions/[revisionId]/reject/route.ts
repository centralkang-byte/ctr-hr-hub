// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Goal Revision Reject
// Phase C: 매니저가 목표 수정 제안 거부
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
    const { id, revisionId } = await context.params
    const body: unknown = await req.json()
    const parsed = rejectSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('거부 사유를 입력해야 합니다.', { issues: parsed.error.issues })
    }

    const revision = await prisma.goalRevision.findFirst({
      where: { id: revisionId, goalId: id, companyId: user.companyId },
      include: { goal: { select: { cycleId: true, employeeId: true } } },
    })
    if (!revision) throw notFound('해당 수정 제안을 찾을 수 없습니다.')
    if (revision.status !== ('PENDING' as GoalRevisionStatus)) {
      throw badRequest('승인 대기 상태의 수정 제안만 거부할 수 있습니다.')
    }

    try {
      const updated = await prisma.goalRevision.update({
        where: { id: revisionId },
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
        action: 'performance.goal.revision.reject',
        resourceType: 'goalRevision',
        resourceId: revisionId,
        companyId: updated.companyId,
        changes: { status: 'REJECTED', comment: parsed.data.comment },
        ip,
        userAgent,
      })

      void eventBus.publish(DOMAIN_EVENTS.GOAL_REVISION_REJECTED, {
        ctx: {
          companyId: updated.companyId,
          actorId: user.employeeId,
          occurredAt: new Date(),
        },
        revisionId,
        goalId: id,
        employeeId: revision.proposedById,
        reviewerId: user.employeeId,
        companyId: updated.companyId,
        cycleId: revision.goal.cycleId,
        decision: 'REJECTED',
        comment: parsed.data.comment,
      })

      return apiSuccess({
        ...updated,
        prevWeight: Number(updated.prevWeight),
        newWeight: Number(updated.newWeight),
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
