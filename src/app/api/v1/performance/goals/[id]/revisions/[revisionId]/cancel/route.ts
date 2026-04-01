// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Goal Revision Cancel
// Phase C: 직원이 본인의 수정 제안 취소
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import type { GoalRevisionStatus } from '@/generated/prisma/client'

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id, revisionId } = await context.params

    const revision = await prisma.goalRevision.findFirst({
      where: { id: revisionId, goalId: id, companyId: user.companyId },
    })
    if (!revision) throw notFound('해당 수정 제안을 찾을 수 없습니다.')
    if (revision.status !== ('PENDING' as GoalRevisionStatus)) {
      throw badRequest('승인 대기 상태의 수정 제안만 취소할 수 있습니다.')
    }
    if (revision.proposedById !== user.employeeId) {
      throw forbidden('본인이 제안한 수정만 취소할 수 있습니다.')
    }

    try {
      const updated = await prisma.goalRevision.update({
        where: { id: revisionId },
        data: { status: 'CANCELLED' as GoalRevisionStatus },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.goal.revision.cancel',
        resourceType: 'goalRevision',
        resourceId: revisionId,
        companyId: updated.companyId,
        changes: { status: 'CANCELLED' },
        ip,
        userAgent,
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
  perm(MODULE.PERFORMANCE, ACTION.CREATE),
)
