// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Benefit Enrollment List & Create
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { enrollmentSearchSchema, enrollmentCreateSchema } from '@/lib/schemas/benefits'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/benefits/enrollments ───────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = enrollmentSearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, policyId, employeeId, status } = parsed.data

    const where = {
      policy: { companyId: user.companyId, deletedAt: null },
      ...(policyId ? { policyId } : {}),
      ...(employeeId ? { employeeId } : {}),
      ...(status ? { status } : {}),
    }

    const [enrollments, total] = await Promise.all([
      prisma.employeeBenefit.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          policy: { select: { id: true, name: true, category: true } },
        },
      }),
      prisma.employeeBenefit.count({ where }),
    ])

    return apiPaginated(enrollments, buildPagination(page, limit, total))
  },
  perm(MODULE.BENEFITS, ACTION.VIEW),
)

// ─── POST /api/v1/benefits/enrollments ──────────────────
// Enroll an employee in a benefit policy

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = enrollmentCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { employeeId, policyId, note } = parsed.data

    try {
      const enrollment = await prisma.employeeBenefit.create({
        data: {
          employeeId,
          policyId,
          status: 'ACTIVE',
          enrolledAt: new Date(),
          note,
        },
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          policy: { select: { id: true, name: true, category: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'benefits.enrollment.create',
        resourceType: 'employeeBenefit',
        resourceId: enrollment.id,
        companyId: user.companyId,
        changes: { employeeId, policyId },
        ip,
        userAgent,
      })

      return apiSuccess(enrollment, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.BENEFITS, ACTION.CREATE),
)
