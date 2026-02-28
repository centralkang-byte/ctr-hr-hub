// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Training Course List & Create
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { courseSearchSchema, courseCreateSchema } from '@/lib/schemas/training'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/training/courses ───────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = courseSearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, category, isMandatory, isActive } = parsed.data

    const where = {
      companyId: user.companyId,
      deletedAt: null,
      ...(category ? { category } : {}),
      ...(isMandatory !== undefined ? { isMandatory } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    }

    const [courses, total] = await Promise.all([
      prisma.trainingCourse.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.trainingCourse.count({ where }),
    ])

    const serialized = courses.map((c) => ({
      ...c,
      durationHours: c.durationHours ? Number(c.durationHours) : null,
    }))

    return apiPaginated(serialized, buildPagination(page, limit, total))
  },
  perm(MODULE.TRAINING, ACTION.VIEW),
)

// ─── POST /api/v1/training/courses ──────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = courseCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const course = await prisma.trainingCourse.create({
        data: {
          companyId: user.companyId,
          ...parsed.data,
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'training.course.create',
        resourceType: 'trainingCourse',
        resourceId: course.id,
        companyId: user.companyId,
        changes: { title: parsed.data.title, category: parsed.data.category },
        ip,
        userAgent,
      })

      return apiSuccess(
        { ...course, durationHours: course.durationHours ? Number(course.durationHours) : null },
        201,
      )
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.TRAINING, ACTION.CREATE),
)
