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
import type { SessionUser } from '@/types'
import type { GoalStatus } from '@/generated/prisma/client'

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
          approvedBy: user.employeeId,
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
        changes: { status: 'APPROVED', approvedBy: user.employeeId },
        ip,
        userAgent,
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
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
