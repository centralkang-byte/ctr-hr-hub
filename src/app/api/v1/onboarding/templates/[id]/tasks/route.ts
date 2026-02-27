// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/onboarding/templates/[id]/tasks
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

const taskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  assigneeType: z.enum(['EMPLOYEE', 'MANAGER', 'HR', 'BUDDY']),
  dueDaysAfter: z.number().int().min(0),
  isRequired: z.boolean().default(true),
  category: z.enum(['DOCUMENT', 'TRAINING', 'SETUP', 'INTRODUCTION', 'OTHER']),
})

// ─── Helpers ─────────────────────────────────────────────

async function getTemplateOrThrow(id: string, user: SessionUser) {
  const template = await prisma.onboardingTemplate.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}),
    },
  })
  if (!template) throw notFound('템플릿을 찾을 수 없습니다.')
  return template
}

// ─── GET /api/v1/onboarding/templates/[id]/tasks ─────────

export const GET = withPermission(
  async (_req: NextRequest, ctx, user: SessionUser) => {
    const { id } = await ctx.params
    await getTemplateOrThrow(id, user)

    const tasks = await prisma.onboardingTask.findMany({
      where: { templateId: id },
      orderBy: { sortOrder: 'asc' },
    })
    return apiSuccess(tasks)
  },
  perm(MODULE.ONBOARDING, ACTION.VIEW),
)

// ─── POST /api/v1/onboarding/templates/[id]/tasks ────────

export const POST = withPermission(
  async (req: NextRequest, ctx, user: SessionUser) => {
    const { id } = await ctx.params
    await getTemplateOrThrow(id, user)

    const body = await req.json()
    const parsed = taskSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })
    }

    const maxOrder = await prisma.onboardingTask.aggregate({
      where: { templateId: id },
      _max: { sortOrder: true },
    })
    const sortOrder = (maxOrder._max.sortOrder ?? 0) + 1

    const task = await prisma.onboardingTask.create({
      data: { ...parsed.data, templateId: id, sortOrder },
    })
    return apiSuccess(task, 201)
  },
  perm(MODULE.ONBOARDING, ACTION.CREATE),
)
