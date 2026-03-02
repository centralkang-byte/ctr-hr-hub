// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Pulse Survey Questions Management
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

const upsertSchema = z.object({
  questions: z.array(z.object({
    id: z.string().optional(),
    questionText: z.string().min(1),
    questionType: z.enum(['LIKERT', 'TEXT', 'CHOICE']),
    options: z.any().optional(),
    sortOrder: z.number().int().min(0),
    isRequired: z.boolean().default(true),
  })),
})

// ─── PUT /api/v1/pulse/surveys/[id]/questions ────────────
// Replace all questions (only allowed for PULSE_DRAFT)

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body = await req.json()
    const parsed = upsertSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 데이터입니다.', { issues: parsed.error.issues })

    const survey = await prisma.pulseSurvey.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    })
    if (!survey) throw notFound('설문을 찾을 수 없습니다.')
    if (survey.status !== 'PULSE_DRAFT') {
      throw badRequest('초안 상태의 설문만 질문을 수정할 수 있습니다.')
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        await tx.pulseQuestion.deleteMany({ where: { surveyId: id } })
        await tx.pulseQuestion.createMany({
          data: parsed.data.questions.map((q) => ({
            surveyId: id,
            questionText: q.questionText,
            questionType: q.questionType,
            options: q.options ?? undefined,
            sortOrder: q.sortOrder,
            isRequired: q.isRequired,
          })),
        })
        return tx.pulseQuestion.findMany({
          where: { surveyId: id },
          orderBy: { sortOrder: 'asc' },
        })
      })

      return apiSuccess(result)
    } catch (err) {
      throw handlePrismaError(err)
    }
  },
  perm(MODULE.PULSE, ACTION.UPDATE),
)
