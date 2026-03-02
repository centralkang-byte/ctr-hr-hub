// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Peer Review Nomination Approval/Rejection
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const updateSchema = z.object({
  status: z.enum(['NOMINATION_APPROVED', 'NOMINATION_REJECTED']),
})

// ─── PUT /api/v1/peer-review/nominations/[id] ───────────

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 데이터입니다.', { issues: parsed.error.issues })

    const nomination = await prisma.peerReviewNomination.findUnique({
      where: { id },
      include: { cycle: { select: { companyId: true } } },
    })

    if (!nomination || nomination.cycle.companyId !== user.companyId) {
      throw notFound('추천을 찾을 수 없습니다.')
    }
    if (nomination.status !== 'PROPOSED') {
      throw badRequest('이미 처리된 추천입니다.')
    }

    try {
      const updated = await prisma.peerReviewNomination.update({
        where: { id },
        data: {
          status: parsed.data.status,
          approvedBy: user.employeeId,
          approvedAt: new Date(),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        action: parsed.data.status === 'NOMINATION_APPROVED' ? 'PEER_NOMINATION_APPROVED' : 'PEER_NOMINATION_REJECTED',
        actorId: user.employeeId,
        companyId: user.companyId,
        resourceType: 'PeerReviewNomination',
        resourceId: id,
        ip,
        userAgent,
      })

      return apiSuccess(updated)
    } catch (err) {
      throw handlePrismaError(err)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
