// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PATCH /api/v1/attendance/work-hour-alerts/[id]
// 52시간 경고 해제 (HR Admin only)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { z } from 'zod'
import type { SessionUser } from '@/types'

const resolveSchema = z.object({
  resolveNote: z.string().max(500).optional(),
})

export const PATCH = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const { id } = await context.params

      const body: unknown = await req.json()
      const parsed = resolveSchema.safeParse(body)
      if (!parsed.success) {
        throw badRequest('입력값이 올바르지 않습니다.', { issues: parsed.error.issues })
      }

      const alert = await prisma.workHourAlert.findUnique({ where: { id } })
      if (!alert) throw notFound('경고 기록을 찾을 수 없습니다.')
      if (alert.isResolved) throw badRequest('이미 해제된 경고입니다.')

      const updated = await prisma.workHourAlert.update({
        where: { id },
        data: {
          isResolved: true,
          resolvedBy: user.employeeId,
          resolvedAt: new Date(),
          resolveNote: parsed.data.resolveNote ?? null,
        },
      })

      return apiSuccess(updated)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.UPDATE),
)
