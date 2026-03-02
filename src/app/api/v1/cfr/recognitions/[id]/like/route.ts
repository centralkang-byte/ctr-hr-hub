// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Recognition Like Toggle
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { handlePrismaError, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── POST /api/v1/cfr/recognitions/[id]/like ─────────────

export const POST = withPermission(
  async (_req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const recognition = await prisma.recognition.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!recognition) throw notFound('칭찬을 찾을 수 없습니다.')

    try {
      // Check if already liked
      const existing = await prisma.recognitionLike.findUnique({
        where: { recognitionId_employeeId: { recognitionId: id, employeeId: user.employeeId } },
      })

      if (existing) {
        // Unlike
        await prisma.recognitionLike.delete({ where: { id: existing.id } })
        const count = await prisma.recognitionLike.count({ where: { recognitionId: id } })
        return apiSuccess({ liked: false, likeCount: count })
      } else {
        // Like
        await prisma.recognitionLike.create({
          data: { recognitionId: id, employeeId: user.employeeId },
        })
        const count = await prisma.recognitionLike.count({ where: { recognitionId: id } })
        return apiSuccess({ liked: true, likeCount: count })
      }
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
