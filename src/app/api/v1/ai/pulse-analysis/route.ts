// ═══════════════════════════════════════════════════════════
// CTR HR Hub — AI Pulse Survey Analysis
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { pulseSurveyAnalysis } from '@/lib/claude'
import type { SessionUser } from '@/types'

const bodySchema = z.object({
  surveyId: z.string(),
})

// ─── POST /api/v1/ai/pulse-analysis ─────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body = await req.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 데이터입니다.', { issues: parsed.error.issues })

    const { surveyId } = parsed.data

    const survey = await prisma.pulseSurvey.findFirst({
      where: { id: surveyId, companyId: user.companyId, deletedAt: null },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
      },
    })
    if (!survey) throw notFound('설문을 찾을 수 없습니다.')

    // Get responses
    const responses = await prisma.pulseResponse.findMany({
      where: { surveyId },
    })

    const respondentCount = new Set(responses.map((r) => r.respondentId ?? r.respondentDivisionId)).size

    if (respondentCount < survey.minRespondentsForReport) {
      throw badRequest(`최소 ${survey.minRespondentsForReport}명 이상 응답해야 분석할 수 있습니다.`)
    }

    // Build question results
    const questionResults = survey.questions.map((q) => {
      const qResponses = responses.filter((r) => r.questionId === q.id)

      if (q.questionType === 'LIKERT') {
        const values = qResponses.map((r) => parseInt(r.answerValue, 10)).filter((v) => !isNaN(v))
        const avg = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0
        const distribution: Record<string, number> = {}
        values.forEach((v) => { distribution[String(v)] = (distribution[String(v)] || 0) + 1 })
        return {
          questionText: q.questionText,
          questionType: q.questionType,
          responseCount: qResponses.length,
          average: Math.round(avg * 100) / 100,
          distribution,
        }
      }

      if (q.questionType === 'CHOICE') {
        const distribution: Record<string, number> = {}
        qResponses.forEach((r) => { distribution[r.answerValue] = (distribution[r.answerValue] || 0) + 1 })
        return {
          questionText: q.questionText,
          questionType: q.questionType,
          responseCount: qResponses.length,
          distribution,
        }
      }

      return {
        questionText: q.questionText,
        questionType: q.questionType,
        responseCount: qResponses.length,
        answers: qResponses.map((r) => r.answerValue),
      }
    })

    const result = await pulseSurveyAnalysis(
      {
        surveyTitle: survey.title,
        questionResults,
        totalRespondents: respondentCount,
      },
      user.companyId,
      user.id,
    )

    return apiSuccess(result)
  },
  perm(MODULE.PULSE, ACTION.VIEW),
)
