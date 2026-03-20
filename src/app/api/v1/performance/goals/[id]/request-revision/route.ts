// ═══════════════════════════════════════════════════════════
// CTR HR Hub — MBO Goal Request Revision
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
import type { GoalStatus } from '@/generated/prisma/client'

bootstrapEventHandlers()

// ─── Schema ──────────────────────────────────────────────

const revisionSchema = z.object({
  comment: z.string().min(1).max(2000),
})

// ─── PUT /api/v1/performance/goals/:id/request-revision ──
// Manager requests revision (PENDING_APPROVAL → REJECTED)

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = revisionSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('코멘트를 입력해야 합니다.', { issues: parsed.error.issues })
    }

    const goal = await prisma.mboGoal.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!goal) throw notFound('해당 목표를 찾을 수 없습니다.')

    if (goal.status !== ('PENDING_APPROVAL' as GoalStatus)) {
      throw badRequest('승인 대기 상태의 목표만 수정 요청할 수 있습니다.')
    }

    try {
      const updated = await prisma.mboGoal.update({
        where: { id },
        data: {
          status: 'REJECTED' as GoalStatus,
        },
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          cycle: { select: { id: true, name: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.goal.request-revision',
        resourceType: 'mboGoal',
        resourceId: updated.id,
        companyId: updated.companyId,
        changes: { status: 'REJECTED', comment: parsed.data.comment },
        ip,
        userAgent,
      })

      // ── Fire-and-forget: PERFORMANCE_MBO_GOAL_REVIEWED (REVISION_REQUESTED) ─
      void eventBus.publish(DOMAIN_EVENTS.PERFORMANCE_MBO_GOAL_REVIEWED, {
        ctx: {
          companyId:  updated.companyId,
          actorId:    user.employeeId,
          occurredAt: new Date(),
        },
        employeeId: updated.employeeId,
        companyId:  updated.companyId,
        cycleId:    updated.cycleId,
        reviewerId: user.employeeId,
        decision:   'REVISION_REQUESTED',
        goalId:     updated.id,
        comment:    parsed.data.comment,
      })

      return apiSuccess({
        ...updated,
        weight: Number(updated.weight),
        achievementScore: updated.achievementScore ? Number(updated.achievementScore) : null,
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.UPDATE), // Manager requests revision on subordinate goals
)
