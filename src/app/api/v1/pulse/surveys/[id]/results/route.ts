// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Pulse Survey Results
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/pulse/surveys/[id]/results ──────────────

export const GET = withPermission(
  async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    const survey = await prisma.pulseSurvey.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
      },
    })
    if (!survey) throw notFound('설문을 찾을 수 없습니다.')

    // Count unique respondents
    const respondentCount = await prisma.pulseResponse.groupBy({
      by: ['respondentId'],
      where: { surveyId: id },
    })
    const totalRespondents = respondentCount.length

    if (totalRespondents < survey.minRespondentsForReport) {
      throw badRequest(`최소 ${survey.minRespondentsForReport}명 이상 응답해야 결과를 확인할 수 있습니다.`)
    }

    // Get all responses
    const responses = await prisma.pulseResponse.findMany({
      where: { surveyId: id },
    })

    // Aggregate per question
    const questionResults = survey.questions.map((q) => {
      const qResponses = responses.filter((r) => r.questionId === q.id)

      if (q.questionType === 'LIKERT') {
        const values = qResponses.map((r) => parseInt(r.answerValue, 10)).filter((v) => !isNaN(v))
        const avg = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0
        const distribution: Record<string, number> = {}
        values.forEach((v) => { distribution[String(v)] = (distribution[String(v)] || 0) + 1 })
        return {
          questionId: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          responseCount: qResponses.length,
          average: Math.round(avg * 100) / 100,
          distribution,
        }
      }

      if (q.questionType === 'CHOICE') {
        const distribution: Record<string, number> = {}
        qResponses.forEach((r) => {
          distribution[r.answerValue] = (distribution[r.answerValue] || 0) + 1
        })
        return {
          questionId: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          responseCount: qResponses.length,
          distribution,
        }
      }

      // TEXT
      return {
        questionId: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        responseCount: qResponses.length,
        answers: qResponses.map((r) => r.answerValue),
      }
    })

    // Department breakdown for LIKERT questions
    const departmentBreakdown: Record<string, Record<string, number>> = {}
    const likertQuestions = survey.questions.filter((q) => q.questionType === 'LIKERT')

    for (const q of likertQuestions) {
      const qResponses = responses.filter((r) => r.questionId === q.id && r.respondentDivisionId)
      const byDept: Record<string, number[]> = {}
      qResponses.forEach((r) => {
        const deptId = r.respondentDivisionId!
        if (!byDept[deptId]) byDept[deptId] = []
        const v = parseInt(r.answerValue, 10)
        if (!isNaN(v)) byDept[deptId].push(v)
      })
      departmentBreakdown[q.id] = {}
      Object.entries(byDept).forEach(([deptId, values]) => {
        departmentBreakdown[q.id][deptId] = Math.round(
          (values.reduce((s, v) => s + v, 0) / values.length) * 100
        ) / 100
      })
    }

    return apiSuccess({
      surveyId: id,
      title: survey.title,
      totalRespondents,
      questionResults,
      departmentBreakdown,
    })
  },
  perm(MODULE.PULSE, ACTION.VIEW),
)
