// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Submit Peer Review Evaluation
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const submitSchema = z.object({
  competencyDetail: z.record(z.string(), z.number()),
  comment: z.string().min(10).max(2000),
  competencyScore: z.number().min(1).max(5),
})

// ─── POST /api/v1/peer-review/my-reviews/[nominationId] ─

export const POST = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { nominationId } = await context.params
    const body = await req.json()
    const parsed = submitSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 데이터입니다.', { issues: parsed.error.issues })

    const nomination = await prisma.peerReviewNomination.findUnique({
      where: { id: nominationId },
      include: { cycle: { select: { id: true, companyId: true } } },
    })

    if (!nomination || nomination.cycle.companyId !== user.companyId) {
      throw notFound('추천을 찾을 수 없습니다.')
    }
    if (nomination.nomineeId !== user.employeeId) {
      throw badRequest('본인에게 할당된 평가만 제출할 수 있습니다.')
    }
    if (nomination.status !== 'NOMINATION_APPROVED') {
      throw badRequest('승인된 추천만 평가할 수 있습니다.')
    }

    // Check if already submitted
    const existing = await prisma.performanceEvaluation.findFirst({
      where: {
        cycleId: nomination.cycleId,
        employeeId: nomination.employeeId,
        evaluatorId: user.employeeId,
        evalType: 'PEER',
      },
    })
    if (existing) {
      throw badRequest('이미 평가를 제출했습니다.')
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const evaluation = await tx.performanceEvaluation.create({
          data: {
            cycleId: nomination.cycleId,
            employeeId: nomination.employeeId,
            evaluatorId: user.employeeId,
            evalType: 'PEER',
            competencyScore: parsed.data.competencyScore,
            competencyDetail: parsed.data.competencyDetail as Prisma.InputJsonValue,
            comment: parsed.data.comment,
            status: 'SUBMITTED',
            submittedAt: new Date(),
            companyId: nomination.cycle.companyId,
          },
        })

        // Mark nomination as completed
        await tx.peerReviewNomination.update({
          where: { id: nominationId },
          data: { status: 'NOMINATION_COMPLETED' },
        })

        return evaluation
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        action: 'PEER_REVIEW_SUBMITTED',
        actorId: user.employeeId,
        companyId: user.companyId,
        resourceType: 'PerformanceEvaluation',
        resourceId: result.id,
        ip,
        userAgent,
      })

      return apiSuccess(result, 201)
    } catch (err) {
      throw handlePrismaError(err)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.CREATE),
)
