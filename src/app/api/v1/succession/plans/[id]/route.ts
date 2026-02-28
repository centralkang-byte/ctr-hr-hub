// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Succession Plan Detail, Update & Delete
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { planUpdateSchema } from '@/lib/schemas/succession'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/succession/plans/[id] ──────────────────

export const GET = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    const plan = await prisma.successionPlan.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        department: { select: { id: true, name: true } },
        currentHolder: { select: { id: true, name: true } },
        candidates: {
          include: {
            employee: { select: { id: true, name: true, employeeNo: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!plan) throw notFound('후계 계획을 찾을 수 없습니다.')

    return apiSuccess(plan)
  },
  perm(MODULE.SUCCESSION, ACTION.VIEW),
)

// ─── PUT /api/v1/succession/plans/[id] ──────────────────

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = planUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const existing = await prisma.successionPlan.findFirst({
        where: { id, companyId: user.companyId },
      })
      if (!existing) throw notFound('후계 계획을 찾을 수 없습니다.')

      const data = parsed.data
      const result = await prisma.successionPlan.update({
        where: { id },
        data: {
          ...(data.positionTitle !== undefined && { positionTitle: data.positionTitle }),
          ...(data.departmentId !== undefined && { departmentId: data.departmentId }),
          ...(data.currentHolderId !== undefined && { currentHolderId: data.currentHolderId }),
          ...(data.criticality !== undefined && { criticality: data.criticality }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.notes !== undefined && { notes: data.notes }),
        },
        include: {
          department: { select: { id: true, name: true } },
          currentHolder: { select: { id: true, name: true } },
          _count: { select: { candidates: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'succession.plan.update',
        resourceType: 'successionPlan',
        resourceId: result.id,
        companyId: user.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(result)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SUCCESSION, ACTION.UPDATE),
)

// ─── DELETE /api/v1/succession/plans/[id] ───────────────

export const DELETE = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    try {
      const existing = await prisma.successionPlan.findFirst({
        where: { id, companyId: user.companyId },
      })
      if (!existing) throw notFound('후계 계획을 찾을 수 없습니다.')

      await prisma.successionCandidate.deleteMany({ where: { planId: id } })
      await prisma.successionPlan.delete({ where: { id } })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'succession.plan.delete',
        resourceType: 'successionPlan',
        resourceId: id,
        companyId: user.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({ id })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SUCCESSION, ACTION.DELETE),
)
