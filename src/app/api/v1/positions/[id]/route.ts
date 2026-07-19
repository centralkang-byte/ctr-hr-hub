// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /api/v1/positions/[id]
// PUT: 직위 수정 / DELETE: 직위 삭제
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { notFound, isAppError, handlePrismaError } from '@/lib/errors'
import {
  lockActivePositionReferences,
  softDeletePositionMaster,
} from '@/lib/employee/assignment-master-lifecycle'
import type { SessionUser } from '@/types'

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const { titleKo, titleEn, code, reportsToPositionId, jobGradeId } = body as Record<string, string | undefined | null>

    try {
      const updated = await prisma.$transaction(async (tx) => {
        await lockActivePositionReferences(tx, {
          companyId: user.companyId,
          positionIds: [id, reportsToPositionId],
          forUpdatePositionIds: [id],
        })

        const existing = await tx.position.findFirst({
          where: { id, companyId: user.companyId, deletedAt: null },
        })
        if (!existing) throw notFound('직위를 찾을 수 없습니다.')

        return tx.position.update({
          where: { id },
          data: {
            ...(titleKo !== undefined && { titleKo: titleKo?.trim() ?? existing.titleKo }),
            ...(titleEn !== undefined && { titleEn: titleEn?.trim() ?? existing.titleEn }),
            ...(code !== undefined && { code: code?.trim() ?? existing.code }),
            reportsToPositionId: reportsToPositionId ?? null,
            jobGradeId: jobGradeId ?? null,
          },
          select: {
            id: true, titleKo: true, titleEn: true, code: true, companyId: true,
            reportsTo: { select: { id: true, titleKo: true } },
            jobGrade: { select: { id: true, name: true } },
          },
        })
      })
      return apiSuccess(updated)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)

export const DELETE = withPermission(
  async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    try {
      await softDeletePositionMaster({
        positionId: id,
        companyId: user.companyId,
      })
      return apiSuccess({ id })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.DELETE),
)
