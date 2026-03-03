// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /api/v1/org/restructure-plans/[id]
// B8-1 Task 6: 조직 개편 Plan GET / PATCH / DELETE
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

type RouteContext = { params: Promise<Record<string, string>> }

const patchPlanSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  changes: z.array(z.record(z.string(), z.unknown())).optional(),
  status: z.enum(['draft', 'review', 'approved']).optional(),
})

// ─── GET /api/v1/org/restructure-plans/[id] ─────────────────

export const GET = withPermission(
  async (_req: NextRequest, context: RouteContext, user: SessionUser) => {
    const { id } = await context.params

    const plan = await prisma.orgRestructurePlan.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
      },
    })

    if (!plan) throw notFound('개편 계획을 찾을 수 없습니다.')

    // Non-SUPER_ADMIN: verify ownership
    if (user.role !== ROLE.SUPER_ADMIN && plan.companyId !== user.companyId) {
      throw notFound('개편 계획을 찾을 수 없습니다.')
    }

    return apiSuccess(plan)
  },
  perm(MODULE.ORG, ACTION.VIEW),
)

// ─── PATCH /api/v1/org/restructure-plans/[id] ───────────────

export const PATCH = withPermission(
  async (req: NextRequest, context: RouteContext, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = patchPlanSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const existing = await prisma.orgRestructurePlan.findUnique({ where: { id } })
    if (!existing) throw notFound('개편 계획을 찾을 수 없습니다.')
    if (user.role !== ROLE.SUPER_ADMIN && existing.companyId !== user.companyId) {
      throw notFound('개편 계획을 찾을 수 없습니다.')
    }
    if (existing.appliedAt) {
      throw badRequest('이미 적용된 계획은 수정할 수 없습니다.')
    }

    const { title, description, effectiveDate, changes, status } = parsed.data

    try {
      const data: Record<string, unknown> = {}
      if (title !== undefined) data.title = title
      if (description !== undefined) data.description = description
      if (effectiveDate !== undefined) data.effectiveDate = new Date(effectiveDate)
      if (changes !== undefined) data.changes = changes
      if (status !== undefined) {
        data.status = status
        if (status === 'approved') {
          data.approvedBy = user.employeeId
          data.approvedAt = new Date()
        }
      }

      const updated = await prisma.orgRestructurePlan.update({
        where: { id },
        data,
      })

      return apiSuccess(updated)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ORG, ACTION.UPDATE),
)

// ─── DELETE /api/v1/org/restructure-plans/[id] ──────────────

export const DELETE = withPermission(
  async (_req: NextRequest, context: RouteContext, user: SessionUser) => {
    const { id } = await context.params

    const existing = await prisma.orgRestructurePlan.findUnique({ where: { id } })
    if (!existing) throw notFound('개편 계획을 찾을 수 없습니다.')
    if (user.role !== ROLE.SUPER_ADMIN && existing.companyId !== user.companyId) {
      throw notFound('개편 계획을 찾을 수 없습니다.')
    }
    if (existing.appliedAt) {
      throw badRequest('이미 적용된 계획은 삭제할 수 없습니다.')
    }

    try {
      await prisma.orgRestructurePlan.delete({ where: { id } })
      return apiSuccess({ deleted: true })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ORG, ACTION.DELETE),
)
