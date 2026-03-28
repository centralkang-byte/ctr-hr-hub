// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /api/v1/positions/[id]
// PUT: 직위 수정 / DELETE: 직위 삭제
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { badRequest, notFound, isAppError, handlePrismaError } from '@/lib/errors'
import type { SessionUser } from '@/types'

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const { titleKo, titleEn, code, reportsToPositionId, jobGradeId } = body as Record<string, string | undefined | null>

    try {
      const existing = await prisma.position.findFirst({
        where: { id, companyId: user.companyId },
      })
      if (!existing) throw notFound('직위를 찾을 수 없습니다.')

      const updated = await prisma.position.update({
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
      const existing = await prisma.position.findFirst({
        where: { id, companyId: user.companyId },
      })
      if (!existing) throw notFound('직위를 찾을 수 없습니다.')

      const activeCount = await prisma.employeeAssignment.count({
        where: { positionId: id, endDate: null },
      })
      if (activeCount > 0) throw badRequest(`현재 ${activeCount}명이 배정된 직위는 삭제할 수 없습니다.`)

      await prisma.position.delete({ where: { id } })
      return apiSuccess({ id })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.DELETE),
)
