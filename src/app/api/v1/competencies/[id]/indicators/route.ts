// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Competency Indicators (bulk replace)
// GET/PUT /api/v1/competencies/[id]/indicators
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const indicatorItemSchema = z.object({
  indicatorText: z.string().min(1),
  indicatorTextEn: z.string().optional(),
  displayOrder: z.number().int().min(1),
  isActive: z.boolean().default(true),
})

const bulkSchema = z.object({ indicators: z.array(indicatorItemSchema) })

export const GET = withPermission(
  async (_req: NextRequest, ctx: { params: Promise<Record<string, string>> }, _user: SessionUser) => {
    const { id } = await ctx.params
    const items = await prisma.competencyIndicator.findMany({
      where: { competencyId: id },
      orderBy: { displayOrder: 'asc' },
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
        await tx.competencyIndicator.deleteMany({ where: { competencyId } })
        if (parsed.data.indicators.length > 0) {
          await tx.competencyIndicator.createMany({
            data: parsed.data.indicators.map((ind, idx) => ({
              competencyId,
              indicatorText: ind.indicatorText,
              indicatorTextEn: ind.indicatorTextEn ?? undefined,
              displayOrder: ind.displayOrder ?? idx + 1,
              isActive: ind.isActive,
            })),
          })
        }
        return tx.competencyIndicator.findMany({
          where: { competencyId },
          orderBy: { displayOrder: 'asc' },
        })
      })
      return apiSuccess(updated)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)
