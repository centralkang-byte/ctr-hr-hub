// ═══════════════════════════════════════════════════════════
// CTR HR Hub — MBO Goal Submit for Approval
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import type { GoalStatus } from '@/generated/prisma/client'

// ─── PUT /api/v1/performance/goals/:id/submit ────────────
// Submit all DRAFT goals for this employee+cycle for approval.
// Validates total weight = 100%.

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    // Verify the referenced goal exists and belongs to user
    const goal = await prisma.mboGoal.findFirst({
      where: { id, employeeId: user.employeeId, companyId: user.companyId },
    })
    if (!goal) throw notFound('해당 목표를 찾을 수 없습니다.')

    if (goal.status !== ('DRAFT' as GoalStatus)) {
      throw badRequest('DRAFT 상태의 목표만 제출할 수 있습니다.')
    }

    // Get ALL goals for this employee+cycle to validate weight
    const goals = await prisma.mboGoal.findMany({
      where: {
        cycleId: goal.cycleId,
        employeeId: user.employeeId,
        companyId: user.companyId,
      },
    })

    const totalWeight = goals.reduce((sum, g) => sum + Number(g.weight), 0)
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw badRequest('목표 가중치 합계가 100%가 아닙니다.', { totalWeight })
    }

    // Update ALL DRAFT goals to PENDING_APPROVAL
    const result = await prisma.mboGoal.updateMany({
      where: {
        cycleId: goal.cycleId,
        employeeId: user.employeeId,
        companyId: user.companyId,
        status: 'DRAFT' as GoalStatus,
      },
      data: { status: 'PENDING_APPROVAL' as GoalStatus },
    })

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'performance.goal.submit',
      resourceType: 'mboGoal',
      resourceId: id,
      companyId: user.companyId,
      changes: { cycleId: goal.cycleId, submittedCount: result.count, totalWeight },
      ip,
      userAgent,
    })

    return apiSuccess({ submitted: result.count, totalWeight })
  },
  perm(MODULE.PERFORMANCE, ACTION.UPDATE),
)
