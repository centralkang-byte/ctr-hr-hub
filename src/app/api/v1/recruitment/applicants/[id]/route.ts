// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/PUT /api/v1/recruitment/applicants/[id]
// (Application detail + update)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Update Schema ───────────────────────────────────────

const updateSchema = z.object({
  aiScreeningScore: z.number().int().min(0).max(100).nullable().optional(),
  aiScreeningSummary: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
})

// ─── GET /api/v1/recruitment/applicants/[id] ─────────────

export const GET = withPermission(
  async (_req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter =
      user.role === ROLE.SUPER_ADMIN
        ? {}
        : { posting: { companyId: user.companyId } }

    const application = await prisma.application.findFirst({
      where: { id, ...companyFilter },
      include: {
        applicant: true,
        posting: {
          select: {
            id: true,
            title: true,
            status: true,
            companyId: true,
          },
        },
        interviewSchedules: {
          orderBy: { scheduledAt: 'asc' },
          include: {
            interviewer: {
              select: { id: true, name: true },
            },
            interviewEvaluations: {
              include: {
                evaluator: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
    })

    if (!application) {
      throw notFound('지원 정보를 찾을 수 없습니다.')
    }

    return apiSuccess({
      ...application,
      offeredSalary: application.offeredSalary
        ? Number(application.offeredSalary)
        : null,
    })
  },
  perm(MODULE.RECRUITMENT, ACTION.VIEW),
)

// ─── PUT /api/v1/recruitment/applicants/[id] ─────────────

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter =
      user.role === ROLE.SUPER_ADMIN
        ? {}
        : { posting: { companyId: user.companyId } }

    const existing = await prisma.application.findFirst({
      where: { id, ...companyFilter },
      include: {
        posting: { select: { companyId: true } },
      },
    })

    if (!existing) {
      throw notFound('지원 정보를 찾을 수 없습니다.')
    }

    const body: unknown = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const data = parsed.data

    try {
      const updated = await prisma.application.update({
        where: { id },
        data: {
          ...(data.aiScreeningScore !== undefined
            ? { aiScreeningScore: data.aiScreeningScore }
            : {}),
          ...(data.aiScreeningSummary !== undefined
            ? { aiScreeningSummary: data.aiScreeningSummary }
            : {}),
          ...(data.rejectionReason !== undefined
            ? { rejectionReason: data.rejectionReason }
            : {}),
        },
        include: {
          applicant: true,
          posting: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'recruitment.application.update',
        resourceType: 'application',
        resourceId: id,
        companyId: existing.posting.companyId,
        changes: JSON.parse(JSON.stringify(data)),
        ip,
        userAgent,
      })

      return apiSuccess({
        ...updated,
        offeredSalary: updated.offeredSalary
          ? Number(updated.offeredSalary)
          : null,
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.UPDATE),
)
