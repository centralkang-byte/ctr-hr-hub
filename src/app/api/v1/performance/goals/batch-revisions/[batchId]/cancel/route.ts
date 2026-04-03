// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Batch Goal Revision Cancel
// Phase C: 직원이 본인 배치 수정 제안 일괄 취소
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { forbidden, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import type { GoalRevisionStatus } from '@/generated/prisma/client'

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { batchId } = await context.params

    const revisions = await prisma.goalRevision.findMany({
      where: { batchId, status: 'PENDING' as GoalRevisionStatus, companyId: user.companyId },
    })
    if (revisions.length === 0) throw notFound('해당 배치의 승인 대기 수정 제안이 없습니다.')

    // 본인 배치만 취소 가능
    const allMine = revisions.every((r) => r.proposedById === user.employeeId)
    if (!allMine) throw forbidden('본인이 제안한 배치만 취소할 수 있습니다.')

    try {
      await prisma.goalRevision.updateMany({
        where: { batchId, status: 'PENDING' as GoalRevisionStatus },
        data: { status: 'CANCELLED' as GoalRevisionStatus },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.goal.revision.batch-cancel',
        resourceType: 'goalRevision',
        resourceId: batchId,
        companyId: user.companyId,
        changes: { batchId, count: revisions.length, status: 'CANCELLED' },
        ip,
        userAgent,
      })

      return apiSuccess({ batchId, cancelledCount: revisions.length })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.CREATE),
)
