// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Pulse Survey CRUD
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Schemas ──────────────────────────────────────────────

const listSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  size: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['PULSE_DRAFT', 'PULSE_ACTIVE', 'PULSE_CLOSED']).optional(),
})

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  targetScope: z.enum(['ALL', 'DIVISION', 'DEPARTMENT', 'TEAM']),
  targetIds: z.array(z.string()).optional(),
  anonymityLevel: z.enum(['FULL_DIVISION', 'FULL_ANONYMOUS']),
  minRespondentsForReport: z.number().int().min(1).default(5),
  openAt: z.string().datetime(),
  closeAt: z.string().datetime(),
  questions: z.array(z.object({
    questionText: z.string().min(1),
    questionType: z.enum(['LIKERT', 'TEXT', 'CHOICE']),
    options: z.any().optional(),
    sortOrder: z.number().int().min(0),
    isRequired: z.boolean().default(true),
  })).min(1),
})

// ─── GET /api/v1/pulse/surveys ────────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = listSchema.safeParse(params)
    if (!parsed.success) throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })

    const { page, size, status } = parsed.data

    const where = {
      companyId: user.companyId,
      deletedAt: null,
      ...(status ? { status } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.pulseSurvey.findMany({
        where,
        include: {
          _count: { select: { questions: true, responses: true } },
          creator: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      prisma.pulseSurvey.count({ where }),
    ])

    return apiPaginated(items, buildPagination(page, size, total))
  },
  perm(MODULE.PULSE, ACTION.VIEW),
)

// ─── POST /api/v1/pulse/surveys ───────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 데이터입니다.', { issues: parsed.error.issues })

    const { questions, ...surveyData } = parsed.data

    try {
      const survey = await prisma.$transaction(async (tx) => {
        const created = await tx.pulseSurvey.create({
          data: {
            ...surveyData,
            openAt: new Date(surveyData.openAt),
            closeAt: new Date(surveyData.closeAt),
            targetIds: surveyData.targetIds ?? undefined,
            companyId: user.companyId,
            createdBy: user.id,
            status: 'PULSE_DRAFT',
          },
        })

        await tx.pulseQuestion.createMany({
          data: questions.map((q) => ({
            surveyId: created.id,
            questionText: q.questionText,
            questionType: q.questionType,
            options: q.options ?? undefined,
            sortOrder: q.sortOrder,
            isRequired: q.isRequired,
          })),
        })

        return created
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        action: 'PULSE_SURVEY_CREATED',
        actorId: user.employeeId,
        companyId: user.companyId,
        resourceType: 'PulseSurvey',
        resourceId: survey.id,
        changes: { title: surveyData.title },
        ip,
        userAgent,
      })

      return apiSuccess(survey, 201)
    } catch (err) {
      throw handlePrismaError(err)
    }
  },
  perm(MODULE.PULSE, ACTION.CREATE),
)
