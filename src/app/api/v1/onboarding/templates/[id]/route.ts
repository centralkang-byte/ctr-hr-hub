// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/PUT/DELETE /api/v1/onboarding/templates/[id]
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
  description: z.string().optional(),
  targetType: z.enum(['NEW_HIRE', 'TRANSFER', 'REHIRE']).optional(),
  isActive: z.boolean().optional(),
})

// ─── GET /api/v1/onboarding/templates/[id] ───────────────

export const GET = withPermission(
  async (_req: NextRequest, ctx, user: SessionUser) => {
    const { id } = await ctx.params
    const template = await prisma.onboardingTemplate.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}),
      },
      include: { onboardingTasks: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!template) throw notFound('템플릿을 찾을 수 없습니다.')
    return apiSuccess(template)
  },
  perm(MODULE.ONBOARDING, ACTION.VIEW),
)

// ─── PUT /api/v1/onboarding/templates/[id] ───────────────

export const PUT = withPermission(
  async (req: NextRequest, ctx, user: SessionUser) => {
    const { id } = await ctx.params
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })
    }

    const existing = await prisma.onboardingTemplate.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}),
      },
    })
    if (!existing) throw notFound('템플릿을 찾을 수 없습니다.')

    const updated = await prisma.onboardingTemplate.update({
      where: { id },
      data: parsed.data,
    })
    return apiSuccess(updated)
  },
  perm(MODULE.ONBOARDING, ACTION.UPDATE),
)

// ─── DELETE /api/v1/onboarding/templates/[id] ────────────

export const DELETE = withPermission(
  async (_req: NextRequest, ctx, user: SessionUser) => {
    const { id } = await ctx.params
    const existing = await prisma.onboardingTemplate.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}),
      },
    })
    if (!existing) throw notFound('템플릿을 찾을 수 없습니다.')

    await prisma.onboardingTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
    return apiSuccess({ deleted: true })
  },
  perm(MODULE.ONBOARDING, ACTION.DELETE),
)
