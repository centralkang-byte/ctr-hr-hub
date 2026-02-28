// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Training Course Detail, Update & Delete
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { courseUpdateSchema } from '@/lib/schemas/training'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/training/courses/[id] ──────────────────

export const GET = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    const course = await prisma.trainingCourse.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
      include: {
        _count: { select: { enrollments: true } },
      },
    })

    if (!course) throw notFound('교육과정을 찾을 수 없습니다.')

    return apiSuccess({
      ...course,
      durationHours: course.durationHours ? Number(course.durationHours) : null,
    })
  },
  perm(MODULE.TRAINING, ACTION.VIEW),
)

// ─── PUT /api/v1/training/courses/[id] ──────────────────

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = courseUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const existing = await prisma.trainingCourse.findFirst({
        where: { id, companyId: user.companyId, deletedAt: null },
      })
      if (!existing) throw notFound('교육과정을 찾을 수 없습니다.')

      const data = parsed.data
      const result = await prisma.trainingCourse.update({
        where: { id },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.category !== undefined && { category: data.category }),
          ...(data.isMandatory !== undefined && { isMandatory: data.isMandatory }),
          ...(data.durationHours !== undefined && { durationHours: data.durationHours }),
          ...(data.provider !== undefined && { provider: data.provider }),
          ...(data.externalUrl !== undefined && { externalUrl: data.externalUrl }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'training.course.update',
        resourceType: 'trainingCourse',
        resourceId: result.id,
        companyId: user.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({
        ...result,
        durationHours: result.durationHours ? Number(result.durationHours) : null,
      })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.TRAINING, ACTION.UPDATE),
)

// ─── DELETE /api/v1/training/courses/[id] ───────────────

export const DELETE = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    try {
      const existing = await prisma.trainingCourse.findFirst({
        where: { id, companyId: user.companyId, deletedAt: null },
      })
      if (!existing) throw notFound('교육과정을 찾을 수 없습니다.')

      const result = await prisma.trainingCourse.update({
        where: { id },
        data: { deletedAt: new Date() },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'training.course.delete',
        resourceType: 'trainingCourse',
        resourceId: result.id,
        companyId: user.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({ id: result.id })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.TRAINING, ACTION.DELETE),
)
