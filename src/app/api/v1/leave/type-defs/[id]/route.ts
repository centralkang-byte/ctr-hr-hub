// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Type Def Detail API (B6-2)
// GET    /api/v1/leave/type-defs/[id]
// PUT    /api/v1/leave/type-defs/[id]
// DELETE /api/v1/leave/type-defs/[id]
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { z } from 'zod'
import type { SessionUser } from '@/types'

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  nameEn: z.string().max(100).optional(),
  isPaid: z.boolean().optional(),
  allowHalfDay: z.boolean().optional(),
  requiresProof: z.boolean().optional(),
  maxConsecutiveDays: z.number().int().positive().nullable().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const GET = withPermission(
  async (_req: NextRequest, context, _user: SessionUser) => {
    const { id } = await context.params
    const typeDef = await prisma.leaveTypeDef.findUnique({
      where: { id },
      include: {
        accrualRules: { where: { deletedAt: null } },
      },
    })
    if (!typeDef) throw notFound('휴가 유형을 찾을 수 없습니다.')
    return apiSuccess(typeDef)
  },
  perm(MODULE.LEAVE, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req: NextRequest, context, _user: SessionUser) => {
    const { id } = await context.params
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)

    const typeDef = await prisma.leaveTypeDef.update({
      where: { id },
      data: parsed.data,
    })
    return apiSuccess(typeDef)
  },
  perm(MODULE.LEAVE, ACTION.UPDATE),
)

export const DELETE = withPermission(
  async (_req: NextRequest, context, _user: SessionUser) => {
    const { id } = await context.params
    // 소프트 삭제 (잔여 데이터 보존)
    await prisma.leaveTypeDef.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
    return apiSuccess({ id, deleted: true })
  },
  perm(MODULE.LEAVE, ACTION.DELETE),
)
