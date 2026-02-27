// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/offboarding/checklists/[id]/tasks
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
  assigneeType: z.enum(['EMPLOYEE', 'MANAGER', 'HR', 'IT', 'FINANCE']),
  dueDaysBefore: z.number().int().min(0),
  isRequired: z.boolean().default(true),
})

// ─── Helpers ─────────────────────────────────────────────

async function getChecklistOrThrow(id: string, user: SessionUser) {
  const checklist = await prisma.offboardingChecklist.findFirst({
    where: {
      id,
      ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}),
    },
  })
  if (!checklist) throw notFound('체크리스트를 찾을 수 없습니다.')
  return checklist
}

// ─── GET /api/v1/offboarding/checklists/[id]/tasks ───────

export const GET = withPermission(
  async (_req: NextRequest, ctx, user: SessionUser) => {
    const { id } = await ctx.params
    await getChecklistOrThrow(id, user)

    const tasks = await prisma.offboardingTask.findMany({
      where: { checklistId: id },
      orderBy: { sortOrder: 'asc' },
    })
    return apiSuccess(tasks)
  },
  perm(MODULE.OFFBOARDING, ACTION.VIEW),
)

// ─── POST /api/v1/offboarding/checklists/[id]/tasks ──────

export const POST = withPermission(
  async (req: NextRequest, ctx, user: SessionUser) => {
    const { id } = await ctx.params
    await getChecklistOrThrow(id, user)

    const body = await req.json()
    const parsed = taskSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })
    }

    const maxOrder = await prisma.offboardingTask.aggregate({
      where: { checklistId: id },
      _max: { sortOrder: true },
    })
    const sortOrder = (maxOrder._max.sortOrder ?? 0) + 1

    const task = await prisma.offboardingTask.create({
      data: { ...parsed.data, checklistId: id, sortOrder },
    })
    return apiSuccess(task, 201)
  },
  perm(MODULE.OFFBOARDING, ACTION.CREATE),
)
