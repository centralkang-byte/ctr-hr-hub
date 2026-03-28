// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Competency Detail / Update / Delete
// GET/PUT/DELETE /api/v1/competencies/[id]
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  nameEn: z.string().max(100).optional(),
  description: z.string().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const GET = withPermission(
  async (_req: NextRequest, ctx: { params: Promise<Record<string, string>> }, _user: SessionUser) => {
    const { id } = await ctx.params
    const item = await prisma.competency.findUnique({
      where: { id },
      include: {
        category: true,
        indicators: { where: { deletedAt: null }, orderBy: { displayOrder: 'asc' } },
        levels: { orderBy: { level: 'asc' } },
        requirements: true,
      },
    })
    if (!item) throw notFound('역량을 찾을 수 없습니다.')
    return apiSuccess(item)
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }, _user: SessionUser) => {
    const { id } = await ctx.params
    const body: unknown = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청 데이터', { issues: parsed.error.issues })

    try {
      const item = await prisma.competency.update({ where: { id }, data: parsed.data })
      return apiSuccess(item)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)

export const DELETE = withPermission(
  async (_req: NextRequest, ctx: { params: Promise<Record<string, string>> }, _user: SessionUser) => {
    const { id } = await ctx.params
    try {
      await prisma.competency.delete({ where: { id } })
      return apiSuccess({ deleted: true })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.DELETE),
)
