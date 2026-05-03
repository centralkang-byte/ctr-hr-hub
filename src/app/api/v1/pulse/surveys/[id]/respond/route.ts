// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Pulse Survey Response Submission
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden, notFound, handlePrismaError } from '@/lib/errors'
import { withAuth } from '@/lib/permissions'
import type { SessionUser } from '@/types'

// ─── Schemas ──────────────────────────────────────────────

const respondSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().min(1),
    answerValue: z.string(),
  })).min(1),
})

// ─── POST /api/v1/pulse/surveys/[id]/respond ─────────────
// Self-action: any authenticated employee can respond to a pulse survey that
// targets them (scope check below). Mirrors `/performance/checkins` and
// `/recruitment/internal-jobs/[id]/apply` — `withAuth` instead of module perm.

export const POST = withAuth(
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

    // Respondent's current primary assignment (for targetScope eligibility + division grouping)
    const currentAsgn = await prisma.employeeAssignment.findFirst({
      where: { employeeId: user.employeeId, isPrimary: true, endDate: null },
      select: { departmentId: true },
    })

    // targetScope eligibility — ALL passes all company members.
    // DEPARTMENT/DIVISION/TEAM resolve by walking the user's department
    // ancestor chain. DEPARTMENT = direct match, DIVISION = ancestor match,
    // TEAM = leaf match (all three are department IDs at different hierarchy levels).
    // Note: existing survey create/update schema allows `targetIds` to be omitted
    // even when scope != ALL. If targetIds is empty, fall through as ALL (backward
    // compat) — follow-up to require targetIds at creation time.
    if (survey.targetScope !== 'ALL') {
      const targetIds = Array.isArray(survey.targetIds) ? (survey.targetIds as string[]) : []
      if (targetIds.length > 0) {
        let eligible = false
        if (currentAsgn?.departmentId) {
          let cursor: string | null = currentAsgn.departmentId
          const visited = new Set<string>()
          while (cursor && !visited.has(cursor) && visited.size < 16) {
            if (targetIds.includes(cursor)) {
              eligible = true
              break
            }
            visited.add(cursor)
            const parent: { parentId: string | null } | null = await prisma.department.findUnique({
              where: { id: cursor },
              select: { parentId: true },
            })
            cursor = parent?.parentId ?? null
          }
        }
        if (!eligible) throw forbidden('이 설문의 대상자가 아닙니다.')
      }
    }

    // Duplicate response check (non-anonymous surveys only — FULL_ANONYMOUS stores
    // respondentId: null so this lookup cannot dedupe; follow-up for anonymous dedup).
    // respondentId is an Employee FK — use user.employeeId, not user.id (session subject).
    if (survey.anonymityLevel !== 'FULL_ANONYMOUS') {
      const existingResponse = await prisma.pulseResponse.findFirst({
        where: { surveyId: id, respondentId: user.employeeId },
      })
      if (existingResponse) {
        throw badRequest('이미 응답한 설문입니다.')
      }
    }

    // Validate submitted questionIds belong to this survey + no duplicates
    const surveyQuestionIds = new Set(survey.questions.map((q) => q.id))
    const submittedIds = parsed.data.answers.map((a) => a.questionId)
    const foreign = submittedIds.filter((qId) => !surveyQuestionIds.has(qId))
    if (foreign.length > 0) throw badRequest('알 수 없는 질문 ID가 포함되었습니다.')
    if (new Set(submittedIds).size !== submittedIds.length) {
      throw badRequest('중복된 질문 응답이 있습니다.')
    }

    // Validate all required questions answered
    const requiredIds = survey.questions.filter((q) => q.isRequired).map((q) => q.id)
    const missing = requiredIds.filter((rId) => !submittedIds.includes(rId))
    if (missing.length > 0) {
      throw badRequest('필수 질문에 모두 응답해 주세요.')
    }

    try {
      const responses = await prisma.pulseResponse.createMany({
        data: parsed.data.answers.map((a) => ({
          surveyId: id,
          questionId: a.questionId,
          respondentId: survey.anonymityLevel === 'FULL_ANONYMOUS' ? null : user.employeeId,
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
)
