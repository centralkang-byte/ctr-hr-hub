// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/onboarding/templates/[id]/tasks/reorder
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

const reorderSchema = z.object({
  taskIds: z.array(z.string().uuid()),
})

// ─── PUT /api/v1/onboarding/templates/[id]/tasks/reorder ─

export const PUT = withPermission(
  async (req: NextRequest, ctx, user: SessionUser) => {
    const { id } = await ctx.params
    const template = await prisma.onboardingTemplate.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}),
      },
    })
    if (!template) throw notFound('템플릿을 찾을 수 없습니다.')

    const body = await req.json()
    const parsed = reorderSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })
    }

    await prisma.$transaction(
      parsed.data.taskIds.map((taskId, idx) =>
        prisma.onboardingTask.update({
          where: { id: taskId },
          data: { sortOrder: idx + 1 },
        }),
      ),
    )

    return apiSuccess({ reordered: true })
  },
  perm(MODULE.ONBOARDING, ACTION.UPDATE),
)
