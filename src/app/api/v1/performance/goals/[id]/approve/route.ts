// ═══════════════════════════════════════════════════════════
// CTR HR Hub — MBO Goal Approve
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
import type { GoalStatus } from '@/generated/prisma/client'

bootstrapEventHandlers()

// ─── PUT /api/v1/performance/goals/:id/approve ──────────
// Manager approves a goal (PENDING_APPROVAL → APPROVED)

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const goal = await prisma.mboGoal.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!goal) throw notFound('해당 목표를 찾을 수 없습니다.')

    if (goal.status !== ('PENDING_APPROVAL' as GoalStatus)) {
      throw badRequest('승인 대기 상태의 목표만 승인할 수 있습니다.')
    }

    try {
      const updated = await prisma.mboGoal.update({
        where: { id },
        data: {
          status: 'APPROVED' as GoalStatus,
          approvedById: user.employeeId,
          approvedAt: new Date(),
        },
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          cycle: { select: { id: true, name: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.goal.approve',
        resourceType: 'mboGoal',
        resourceId: updated.id,
        companyId: updated.companyId,
        changes: { status: 'APPROVED', approvedById: user.employeeId },
        ip,
        userAgent,
      })

      // ── Fire-and-forget: PERFORMANCE_MBO_GOAL_REVIEWED (APPROVED) ──────
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
        decision:   'APPROVED',
        goalId:     updated.id,
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
  perm(MODULE.PERFORMANCE, ACTION.UPDATE), // Manager approves subordinate goals
)
