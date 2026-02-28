// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Training Enrollment List & Batch Create
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { trainingEnrollmentSearchSchema, trainingEnrollmentCreateSchema } from '@/lib/schemas/training'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/training/enrollments ───────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = trainingEnrollmentSearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, courseId, employeeId, status } = parsed.data

    const where = {
      course: { companyId: user.companyId, deletedAt: null },
      ...(courseId ? { courseId } : {}),
      ...(employeeId ? { employeeId } : {}),
      ...(status ? { status } : {}),
    }

    const [enrollments, total] = await Promise.all([
      prisma.trainingEnrollment.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          course: { select: { id: true, title: true, category: true, isMandatory: true } },
        },
      }),
      prisma.trainingEnrollment.count({ where }),
    ])

    const serialized = enrollments.map((e) => ({
      ...e,
      score: e.score ? Number(e.score) : null,
    }))

    return apiPaginated(serialized, buildPagination(page, limit, total))
  },
  perm(MODULE.TRAINING, ACTION.VIEW),
)

// ─── POST /api/v1/training/enrollments ──────────────────
// Batch enroll employees in a course

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = trainingEnrollmentCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { courseId, employeeIds } = parsed.data

    try {
      const result = await prisma.trainingEnrollment.createMany({
        data: employeeIds.map((employeeId) => ({
          courseId,
          employeeId,
          status: 'ENROLLED' as const,
          enrolledAt: new Date(),
        })),
        skipDuplicates: true,
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'training.enrollment.batchCreate',
        resourceType: 'trainingEnrollment',
        resourceId: courseId,
        companyId: user.companyId,
        changes: { courseId, employeeCount: employeeIds.length },
        ip,
        userAgent,
      })

      return apiSuccess({ created: result.count }, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.TRAINING, ACTION.CREATE),
)
