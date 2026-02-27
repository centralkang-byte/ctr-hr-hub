// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Performance Cycle Detail & Update
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
import type { CycleStatus } from '@/generated/prisma/client'

// ─── Schemas ──────────────────────────────────────────────

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  goalStart: z.string().datetime().optional(),
  goalEnd: z.string().datetime().optional(),
  evalStart: z.string().datetime().optional(),
  evalEnd: z.string().datetime().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: '최소 하나의 필드를 입력해야 합니다.' },
)

// ─── GET /api/v1/performance/cycles/:id ──────────────────
// Get cycle detail with counts

export const GET = withPermission(
  async (_req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const cycle = await prisma.performanceCycle.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        _count: {
          select: {
            mboGoals: true,
            performanceEvaluations: true,
          },
        },
      },
    })

    if (!cycle) {
      throw notFound('해당 성과 주기를 찾을 수 없습니다.')
    }

    return apiSuccess(cycle)
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)

// ─── PUT /api/v1/performance/cycles/:id ──────────────────
// Partial update (name, dates). Date changes only allowed in DRAFT status.

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const existing = await prisma.performanceCycle.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!existing) {
      throw notFound('해당 성과 주기를 찾을 수 없습니다.')
    }

    const { name, goalStart, goalEnd, evalStart, evalEnd } = parsed.data
    const hasDateChange = goalStart || goalEnd || evalStart || evalEnd

    // Date changes only allowed in DRAFT status
    if (hasDateChange && existing.status !== ('DRAFT' as CycleStatus)) {
      throw badRequest('날짜 변경은 DRAFT 상태에서만 가능합니다.')
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (goalStart !== undefined) updateData.goalStart = new Date(goalStart)
    if (goalEnd !== undefined) updateData.goalEnd = new Date(goalEnd)
    if (evalStart !== undefined) updateData.evalStart = new Date(evalStart)
    if (evalEnd !== undefined) updateData.evalEnd = new Date(evalEnd)

    // Validate date ordering with merged values
    const finalGoalStart = updateData.goalStart
      ? (updateData.goalStart as Date)
      : existing.goalStart
    const finalGoalEnd = updateData.goalEnd
      ? (updateData.goalEnd as Date)
      : existing.goalEnd
    const finalEvalStart = updateData.evalStart
      ? (updateData.evalStart as Date)
      : existing.evalStart
    const finalEvalEnd = updateData.evalEnd
      ? (updateData.evalEnd as Date)
      : existing.evalEnd

    if (finalGoalStart >= finalGoalEnd) {
      throw badRequest('목표 시작일은 종료일보다 이전이어야 합니다.')
    }
    if (finalEvalStart >= finalEvalEnd) {
      throw badRequest('평가 시작일은 종료일보다 이전이어야 합니다.')
    }

    try {
      const updated = await prisma.performanceCycle.update({
        where: { id },
        data: updateData,
        include: {
          _count: {
            select: {
              mboGoals: true,
              performanceEvaluations: true,
            },
          },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.cycle.update',
        resourceType: 'performanceCycle',
        resourceId: updated.id,
        companyId: updated.companyId,
        changes: parsed.data,
        ip,
        userAgent,
      })

      return apiSuccess(updated)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.UPDATE),
)
