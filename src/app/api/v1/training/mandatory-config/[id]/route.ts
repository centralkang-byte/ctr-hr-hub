// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Mandatory Training Config Detail (B9-1)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { z } from 'zod'
import type { SessionUser } from '@/types'

const configUpdateSchema = z.object({
  targetGroup: z.enum(['all', 'manager', 'new_hire', 'production']).optional(),
  frequency: z.enum(['annual', 'biennial', 'once']).optional(),
  deadlineMonth: z.number().int().min(1).max(12).nullable().optional(),
  isActive: z.boolean().optional(),
})

// ─── PATCH /api/v1/training/mandatory-config/[id] ────────

export const PATCH = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, _user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = configUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const existing = await prisma.mandatoryTrainingConfig.findUnique({ where: { id } })
    if (!existing) throw notFound('의무교육 설정을 찾을 수 없습니다.')

    try {
      const updated = await prisma.mandatoryTrainingConfig.update({
        where: { id },
        data: parsed.data,
      })
      return apiSuccess(updated)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.TRAINING, ACTION.UPDATE),
)

// ─── DELETE /api/v1/training/mandatory-config/[id] ───────

export const DELETE = withPermission(
  async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, _user: SessionUser) => {
    const { id } = await context.params

    const existing = await prisma.mandatoryTrainingConfig.findUnique({ where: { id } })
    if (!existing) throw notFound('의무교육 설정을 찾을 수 없습니다.')

    try {
      await prisma.mandatoryTrainingConfig.delete({ where: { id } })
      return apiSuccess({ id })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.TRAINING, ACTION.DELETE),
)
