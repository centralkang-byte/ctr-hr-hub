// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/recruitment/interviews/[id]/evaluate
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, conflict, handlePrismaError } from '@/lib/errors'
import { withAuth, hasPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { forbidden } from '@/lib/errors'
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

export const POST = withAuth(
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

    // Authorization: must be the assigned interviewer OR have recruitment:create permission
    const isInterviewer = schedule.interviewerId === user.employeeId
    const hasRecruitmentCreate = hasPermission(user, perm(MODULE.RECRUITMENT, ACTION.CREATE))
    if (!isInterviewer && !hasRecruitmentCreate) {
      throw forbidden('면접 평가 권한이 없습니다. 배정된 면접관만 평가할 수 있습니다.')
    }

    // Parse request body
    const body: unknown = await req.json()
    const parsed = evaluationSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const data = parsed.data

    // 1H: 중복 평가 방지 — 동일 면접관이 동일 면접에 이중 평가 불가
    const existingEval = await prisma.interviewEvaluation.findFirst({
      where: { scheduleId: id, evaluatorId: user.employeeId },
    })
    if (existingEval) {
      throw conflict('이미 해당 면접에 대한 평가를 제출하셨습니다.')
    }

    // 1H: CANCELLED/NO_SHOW 면접은 평가 불가
    if (schedule.status === 'CANCELLED' || schedule.status === 'NO_SHOW') {
      throw badRequest('취소되었거나 불참 처리된 면접은 평가할 수 없습니다.')
    }

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
)
