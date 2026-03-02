// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Competency Levels (bulk replace)
// GET/PUT /api/v1/competencies/[id]/levels
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const levelItemSchema = z.object({
  level: z.number().int().min(1).max(10),
  label: z.string().min(1).max(100),
  description: z.string().optional(),
})

const bulkSchema = z.object({ levels: z.array(levelItemSchema) })

export const GET = withPermission(
  async (_req: NextRequest, ctx: { params: Promise<Record<string, string>> }, _user: SessionUser) => {
    const { id } = await ctx.params
    const items = await prisma.competencyLevel.findMany({
      where: { competencyId: id },
      orderBy: { level: 'asc' },
    })
    return apiSuccess(items)
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }, _user: SessionUser) => {
    const { id: competencyId } = await ctx.params
    const body: unknown = await req.json()
    const parsed = bulkSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청', { issues: parsed.error.issues })

    try {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.competencyLevel.deleteMany({ where: { competencyId } })
        if (parsed.data.levels.length > 0) {
          await tx.competencyLevel.createMany({
            data: parsed.data.levels.map((l) => ({
              competencyId,
              level: l.level,
              label: l.label,
              description: l.description,
            })),
          })
        }
        return tx.competencyLevel.findMany({
          where: { competencyId },
          orderBy: { level: 'asc' },
        })
      })
      return apiSuccess(updated)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)
