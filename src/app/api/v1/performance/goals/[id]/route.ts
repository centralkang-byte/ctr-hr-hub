// ═══════════════════════════════════════════════════════════
// CTR HR Hub — MBO Goal Detail, Update & Delete
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import type { GoalStatus } from '@/generated/prisma/client'

// ─── Schemas ──────────────────────────────────────────────

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  weight: z.number().min(0).max(100).optional(),
  targetMetric: z.string().max(100).optional(),
  targetValue: z.string().max(100).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: '최소 하나의 필드를 입력해야 합니다.' },
)

// ─── Helper ──────────────────────────────────────────────

async function findGoal(id: string, user: SessionUser) {
  const goal = await prisma.mboGoal.findFirst({
    where: { id, employeeId: user.employeeId, companyId: user.companyId },
    include: {
      cycle: { select: { id: true, name: true, year: true, half: true, status: true } },
      progress: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, progressPct: true, note: true, createdBy: true, createdAt: true },
      },
    },
  })
  if (!goal) throw notFound('해당 목표를 찾을 수 없습니다.')
  return goal
}

// ─── GET /api/v1/performance/goals/:id ───────────────────
// Single goal with all progress history

export const GET = withPermission(
  async (_req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params
    const goal = await findGoal(id, user)

    return apiSuccess({
      ...goal,
      weight: Number(goal.weight),
      achievementScore: goal.achievementScore ? Number(goal.achievementScore) : null,
    })
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)

// ─── PUT /api/v1/performance/goals/:id ───────────────────
// Update goal fields (only if DRAFT or REJECTED status)

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const existing = await prisma.mboGoal.findFirst({
      where: { id, employeeId: user.employeeId, companyId: user.companyId },
    })
    if (!existing) throw notFound('해당 목표를 찾을 수 없습니다.')

    const editableStatuses: GoalStatus[] = ['DRAFT', 'REJECTED']
    if (!editableStatuses.includes(existing.status)) {
      throw badRequest('DRAFT 또는 REJECTED 상태에서만 수정할 수 있습니다.')
    }

    try {
      const updated = await prisma.mboGoal.update({
        where: { id },
        data: parsed.data,
        include: {
          cycle: { select: { id: true, name: true, year: true, half: true } },
          progress: {
            orderBy: { createdAt: 'desc' },
            take: 3,
          },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.goal.update',
        resourceType: 'mboGoal',
        resourceId: updated.id,
        companyId: updated.companyId,
        changes: parsed.data,
        ip,
        userAgent,
      })

      return apiSuccess({
        ...updated,
        weight: Number(updated.weight),
        achievementScore: updated.achievementScore ? Number(updated.achievementScore) : null,
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.UPDATE),
)

// ─── DELETE /api/v1/performance/goals/:id ────────────────
// Hard delete (only if DRAFT status)

export const DELETE = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const existing = await prisma.mboGoal.findFirst({
      where: { id, employeeId: user.employeeId, companyId: user.companyId },
    })
    if (!existing) throw notFound('해당 목표를 찾을 수 없습니다.')

    if (existing.status !== ('DRAFT' as GoalStatus)) {
      throw badRequest('DRAFT 상태에서만 삭제할 수 있습니다.')
    }

    try {
      await prisma.mboGoal.delete({ where: { id } })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.goal.delete',
        resourceType: 'mboGoal',
        resourceId: id,
        companyId: user.companyId,
        changes: { title: existing.title },
        ip,
        userAgent,
      })

      return apiSuccess({ deleted: true })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.DELETE),
)
