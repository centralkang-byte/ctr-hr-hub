// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Performance Cycle Status Advance
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import type { CycleStatus } from '@/generated/prisma/client'

// ─── State Machine ────────────────────────────────────────

const STATUS_TRANSITIONS: Record<string, CycleStatus> = {
  DRAFT: 'ACTIVE' as CycleStatus,
  ACTIVE: 'EVAL_OPEN' as CycleStatus,
  EVAL_OPEN: 'CALIBRATION' as CycleStatus,
  CALIBRATION: 'CLOSED' as CycleStatus,
}

// ─── PUT /api/v1/performance/cycles/:id/advance ──────────
// Advance cycle to next status

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const cycle = await prisma.performanceCycle.findFirst({
      where: { id, companyId: user.companyId },
    })

    if (!cycle) {
      throw notFound('해당 성과 주기를 찾을 수 없습니다.')
    }

    const currentStatus = cycle.status as string
    const nextStatus = STATUS_TRANSITIONS[currentStatus]

    if (!nextStatus) {
      throw badRequest(
        `현재 상태(${currentStatus})에서는 더 이상 진행할 수 없습니다.`,
      )
    }

    try {
      const updated = await prisma.performanceCycle.update({
        where: { id },
        data: { status: nextStatus },
        include: {
          _count: {
            select: {
              mboGoals: true,
              performanceEvaluations: true,
            },
          },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.cycle.advance',
        resourceType: 'performanceCycle',
        resourceId: updated.id,
        companyId: updated.companyId,
        changes: { from: currentStatus, to: nextStatus },
        ip,
        userAgent,
      })

      return apiSuccess(updated)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
