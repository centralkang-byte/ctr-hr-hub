// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/PUT/DELETE /api/v1/offboarding/checklists/[id]
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Schemas ─────────────────────────────────────────────

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  targetType: z.enum(['VOLUNTARY', 'INVOLUNTARY', 'RETIREMENT', 'CONTRACT_END']).optional(),
  isActive: z.boolean().optional(),
})

// ─── GET /api/v1/offboarding/checklists/[id] ─────────────

export const GET = withPermission(
  async (_req: NextRequest, ctx, user: SessionUser) => {
    const { id } = await ctx.params
    const checklist = await prisma.offboardingChecklist.findFirst({
      where: {
        id,
        ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}),
      },
      include: { offboardingTasks: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!checklist) throw notFound('체크리스트를 찾을 수 없습니다.')
    return apiSuccess(checklist)
  },
  perm(MODULE.OFFBOARDING, ACTION.VIEW),
)

// ─── PUT /api/v1/offboarding/checklists/[id] ─────────────

export const PUT = withPermission(
  async (req: NextRequest, ctx, user: SessionUser) => {
    const { id } = await ctx.params
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })
    }

    const existing = await prisma.offboardingChecklist.findFirst({
      where: {
        id,
        ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}),
      },
    })
    if (!existing) throw notFound('체크리스트를 찾을 수 없습니다.')

    const updated = await prisma.offboardingChecklist.update({
      where: { id },
      data: parsed.data,
    })
    return apiSuccess(updated)
  },
  perm(MODULE.OFFBOARDING, ACTION.UPDATE),
)

// ─── DELETE /api/v1/offboarding/checklists/[id] ──────────

export const DELETE = withPermission(
  async (_req: NextRequest, ctx, user: SessionUser) => {
    const { id } = await ctx.params
    const existing = await prisma.offboardingChecklist.findFirst({
      where: {
        id,
        ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}),
      },
    })
    if (!existing) throw notFound('체크리스트를 찾을 수 없습니다.')

    await prisma.offboardingChecklist.update({
      where: { id },
      data: { isActive: false },
    })
    return apiSuccess({ deleted: true })
  },
  perm(MODULE.OFFBOARDING, ACTION.DELETE),
)
