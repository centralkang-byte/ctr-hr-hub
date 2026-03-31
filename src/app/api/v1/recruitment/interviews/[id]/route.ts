// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/PUT/DELETE /api/v1/recruitment/interviews/[id]
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, withAuth, hasPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { forbidden } from '@/lib/errors'
import type { SessionUser } from '@/types'

// ─── Update Schema ───────────────────────────────────────

const updateSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  location: z.string().nullable().optional(),
  meetingLink: z.string().url().or(z.literal('')).nullable().optional(),
  interviewType: z.enum(['PHONE', 'VIDEO', 'ONSITE', 'PANEL']).nullable().optional(),
  round: z.enum(['FIRST', 'SECOND', 'FINAL']).nullable().optional(),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
})

// ─── Helper: find schedule with company scope ────────────

async function findScheduleWithScope(id: string, user: SessionUser) {
  const companyFilter =
    user.role === ROLE.SUPER_ADMIN
      ? {}
      : { application: { posting: { companyId: user.companyId } } }

  return prisma.interviewSchedule.findFirst({
    where: { id, ...companyFilter },
    include: {
      application: {
        select: {
          posting: { select: { companyId: true } },
        },
      },
    },
  })
}

// ─── GET /api/v1/recruitment/interviews/[id] ─────────────

export const GET = withAuth(
  async (_req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter =
      user.role === ROLE.SUPER_ADMIN
        ? {}
        : { application: { posting: { companyId: user.companyId } } }

    const record = await prisma.interviewSchedule.findFirst({
      where: { id, ...companyFilter },
      include: {
        application: {
          select: {
            id: true,
            postingId: true,
            stage: true,
            applicant: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                source: true,
              },
            },
            posting: {
              select: { id: true, title: true },
            },
          },
        },
        interviewer: {
          select: {
            id: true,
            name: true,
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              select: {
                department: { select: { id: true, name: true } },
              },
            },
          },
        },
        interviewEvaluations: {
          select: {
            id: true,
            evaluatorId: true,
            overallScore: true,
            competencyScores: true,
            strengths: true,
            concerns: true,
            recommendation: true,
            comment: true,
            submittedAt: true,
            evaluator: {
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    if (!record) {
      throw notFound('면접 일정을 찾을 수 없습니다.')
    }

    // MANAGER without recruitment permission can only see their own interviews
    const hasFullAccess = hasPermission(user, perm(MODULE.RECRUITMENT, ACTION.VIEW))
    if (!hasFullAccess && record.interviewerId !== user.employeeId) {
      throw forbidden('배정된 면접만 조회할 수 있습니다.')
    }

    return apiSuccess(record)
  },
)

// ─── PUT /api/v1/recruitment/interviews/[id] ─────────────

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const existing = await findScheduleWithScope(id, user)
    if (!existing) {
      throw notFound('면접 일정을 찾을 수 없습니다.')
    }

    const body: unknown = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const data = parsed.data

    // 2C: 평가가 존재하는 면접은 취소 불가
    if (data.status === 'CANCELLED') {
      const evalCount = await prisma.interviewEvaluation.count({
        where: { scheduleId: id },
      })
      if (evalCount > 0) {
        throw badRequest('평가가 제출된 면접은 취소할 수 없습니다.')
      }
    }

    try {
      const updated = await prisma.interviewSchedule.update({
        where: { id },
        data: {
          ...(data.scheduledAt !== undefined
            ? { scheduledAt: new Date(data.scheduledAt) }
            : {}),
          ...(data.durationMinutes !== undefined
            ? { durationMinutes: data.durationMinutes }
            : {}),
          ...(data.location !== undefined ? { location: data.location } : {}),
          ...(data.meetingLink !== undefined
            ? { meetingLink: data.meetingLink || null }
            : {}),
          ...(data.interviewType !== undefined
            ? { interviewType: data.interviewType }
            : {}),
          ...(data.round !== undefined ? { round: data.round } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
        },
        include: {
          application: {
            select: {
              id: true,
              postingId: true,
              applicant: {
                select: { id: true, name: true, email: true },
              },
              posting: {
                select: { id: true, title: true },
              },
            },
          },
          interviewer: {
            select: { id: true, name: true },
          },
          interviewEvaluations: {
            select: {
              id: true,
              overallScore: true,
              recommendation: true,
              evaluator: { select: { id: true, name: true } },
            },
          },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'recruitment.interview.update',
        resourceType: 'interview_schedule',
        resourceId: id,
        companyId: existing.application.posting.companyId,
        changes: JSON.parse(JSON.stringify(data)),
        ip,
        userAgent,
      })

      return apiSuccess(updated)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.UPDATE),
)

// ─── DELETE /api/v1/recruitment/interviews/[id] ──────────

export const DELETE = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const existing = await findScheduleWithScope(id, user)
    if (!existing) {
      throw notFound('면접 일정을 찾을 수 없습니다.')
    }

    // 2C: 평가가 존재하는 면접은 삭제 불가
    const evalCount = await prisma.interviewEvaluation.count({
      where: { scheduleId: id },
    })
    if (evalCount > 0) {
      throw badRequest('평가가 제출된 면접은 삭제할 수 없습니다. 먼저 평가를 삭제해 주세요.')
    }

    await prisma.interviewSchedule.delete({
      where: { id },
    })

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'recruitment.interview.delete',
      resourceType: 'interview_schedule',
      resourceId: id,
      companyId: existing.application.posting.companyId,
      ip,
      userAgent,
    })

    return apiSuccess({ id })
  },
  perm(MODULE.RECRUITMENT, ACTION.DELETE),
)
