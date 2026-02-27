// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/recruitment/interviews/[id]/evaluate
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

// ─── Evaluation Schema ───────────────────────────────────

const evaluationSchema = z.object({
  overallScore: z.number().int().min(1, '최소 1점입니다.').max(5, '최대 5점입니다.'),
  competencyScores: z.record(z.string(), z.number()).refine(
    (val) => Object.keys(val).length > 0,
    { message: '역량 점수를 하나 이상 입력해주세요.' },
  ),
  strengths: z.string().optional(),
  concerns: z.string().optional(),
  recommendation: z.enum(['STRONG_YES', 'YES', 'NEUTRAL', 'NO', 'STRONG_NO'], {
    message: '유효한 추천 의견을 선택해주세요.',
  }),
  comment: z.string().optional(),
})

// ─── POST /api/v1/recruitment/interviews/[id]/evaluate ───

export const POST = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    // Find interview schedule with company scope
    const companyFilter =
      user.role === ROLE.SUPER_ADMIN
        ? {}
        : { application: { posting: { companyId: user.companyId } } }

    const schedule = await prisma.interviewSchedule.findFirst({
      where: { id, ...companyFilter },
      include: {
        application: {
          select: {
            posting: { select: { companyId: true } },
          },
        },
      },
    })

    if (!schedule) {
      throw notFound('면접 일정을 찾을 수 없습니다.')
    }

    // Parse request body
    const body: unknown = await req.json()
    const parsed = evaluationSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const data = parsed.data

    try {
      // Create evaluation and optionally update schedule status in a transaction
      const [evaluation] = await prisma.$transaction(async (tx) => {
        const created = await tx.interviewEvaluation.create({
          data: {
            scheduleId: id,
            evaluatorId: user.employeeId,
            overallScore: data.overallScore,
            competencyScores: data.competencyScores,
            strengths: data.strengths ?? null,
            concerns: data.concerns ?? null,
            recommendation: data.recommendation,
            comment: data.comment ?? null,
            submittedAt: new Date(),
          },
          include: {
            evaluator: {
              select: { id: true, name: true },
            },
            schedule: {
              select: {
                id: true,
                status: true,
                application: {
                  select: {
                    applicant: { select: { id: true, name: true } },
                    posting: { select: { id: true, title: true } },
                  },
                },
              },
            },
          },
        })

        // Auto-update interview status to COMPLETED if it was SCHEDULED
        if (schedule.status === 'SCHEDULED') {
          await tx.interviewSchedule.update({
            where: { id },
            data: { status: 'COMPLETED' },
          })
        }

        return [created]
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'recruitment.interview.evaluate',
        resourceType: 'interview_evaluation',
        resourceId: evaluation.id,
        companyId: schedule.application.posting.companyId,
        changes: {
          scheduleId: id,
          overallScore: data.overallScore,
          recommendation: data.recommendation,
        },
        ip,
        userAgent,
      })

      return apiSuccess(evaluation, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.CREATE),
)
