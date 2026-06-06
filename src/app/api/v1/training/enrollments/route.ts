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

    // 멀티테넌트: 비-SUPER는 course가 본인 법인/글로벌이고 employeeIds가 본인 법인 재직자인지 검증 (SUPER는 cross-company 허용)
    if (user.role !== 'SUPER_ADMIN') {
      const course = await prisma.trainingCourse.findFirst({
        where: { id: courseId, OR: [{ companyId: user.companyId }, { companyId: null }], deletedAt: null },
        select: { id: true },
      })
      if (!course) throw badRequest('유효하지 않은 과정입니다.')
      const uniqueIds = [...new Set(employeeIds)]
      const owned = await prisma.employeeAssignment.findMany({
        where: { employeeId: { in: uniqueIds }, companyId: user.companyId, isPrimary: true, endDate: null, effectiveDate: { lte: new Date() } },
        select: { employeeId: true },
        distinct: ['employeeId'],
      })
      if (owned.length !== uniqueIds.length) {
        throw badRequest('본인 법인 재직 직원이 아닌 대상이 포함되어 있습니다.')
      }
    }

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
