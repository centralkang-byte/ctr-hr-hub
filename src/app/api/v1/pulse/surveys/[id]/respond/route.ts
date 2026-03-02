// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Pulse Survey Response Submission
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Schemas ──────────────────────────────────────────────

const respondSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string(),
    answerValue: z.string(),
  })),
})

// ─── POST /api/v1/pulse/surveys/[id]/respond ─────────────

export const POST = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body = await req.json()
    const parsed = respondSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 응답 데이터입니다.', { issues: parsed.error.issues })

    const survey = await prisma.pulseSurvey.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
      include: { questions: true },
    })

    if (!survey) throw notFound('설문을 찾을 수 없습니다.')
    if (survey.status !== 'PULSE_ACTIVE') {
      throw badRequest('활성 상태의 설문만 응답할 수 있습니다.')
    }

    const now = new Date()
    if (now < survey.openAt || now > survey.closeAt) {
      throw badRequest('설문 응답 기간이 아닙니다.')
    }

    // Check if already responded
    const existingResponse = await prisma.pulseResponse.findFirst({
      where: { surveyId: id, respondentId: user.id },
    })
    if (existingResponse) {
      throw badRequest('이미 응답한 설문입니다.')
    }

    // Validate all required questions answered
    const requiredIds = survey.questions.filter((q) => q.isRequired).map((q) => q.id)
    const answeredIds = parsed.data.answers.map((a) => a.questionId)
    const missing = requiredIds.filter((rId) => !answeredIds.includes(rId))
    if (missing.length > 0) {
      throw badRequest('필수 질문에 모두 응답해 주세요.')
    }

    // Get respondent department for anonymous grouping
    const currentAsgn = await prisma.employeeAssignment.findFirst({
      where: { employeeId: user.employeeId, isPrimary: true, endDate: null },
      select: { departmentId: true },
    })

    try {
      const responses = await prisma.pulseResponse.createMany({
        data: parsed.data.answers.map((a) => ({
          surveyId: id,
          questionId: a.questionId,
          respondentId: survey.anonymityLevel === 'FULL_ANONYMOUS' ? null : user.id,
          respondentDivisionId: currentAsgn?.departmentId ?? null,
          answerValue: a.answerValue,
          submittedAt: now,
          companyId: user.companyId,
        })),
      })

      return apiSuccess({ submitted: responses.count }, 201)
    } catch (err) {
      throw handlePrismaError(err)
    }
  },
  perm(MODULE.PULSE, ACTION.CREATE),
)
