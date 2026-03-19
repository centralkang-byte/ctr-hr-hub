// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Self-Evaluation UPSERT
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { calculateEmsBlock, DEFAULT_BLOCK_DEFINITIONS } from '@/lib/ems'
import { eventBus } from '@/lib/events/event-bus'
import { DOMAIN_EVENTS } from '@/lib/events/types'
import { bootstrapEventHandlers } from '@/lib/events/bootstrap'
import type { SessionUser } from '@/types'
import type { EvalType, EvalStatus, Prisma } from '@/generated/prisma/client'

bootstrapEventHandlers()

// ─── Schemas ──────────────────────────────────────────────

const goalScoreSchema = z.object({
  goalId: z.string(),
  score: z.number().min(1).max(5),
  comment: z.string().max(1000).optional(),
})

const competencyScoreSchema = z.object({
  competencyId: z.string(),
  score: z.number().min(1).max(5),
  comment: z.string().max(1000).optional(),
})

const upsertSchema = z.object({
  cycleId: z.string(),
  goalScores: z.array(goalScoreSchema),
  competencyScores: z.array(competencyScoreSchema),
  overallComment: z.string().max(3000).optional(),
  status: z.enum(['DRAFT', 'SUBMITTED']),
})

// ─── GET /api/v1/performance/evaluations/self ─────────────
// Get current user's self-evaluation for a cycle

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const cycleId = req.nextUrl.searchParams.get('cycleId')
    if (!cycleId) throw badRequest('cycleId 파라미터가 필요합니다.')

    const evaluation = await prisma.performanceEvaluation.findFirst({
      where: {
        cycleId,
        employeeId: user.employeeId,
        evaluatorId: user.employeeId,
        evalType: 'SELF' as EvalType,
        companyId: user.companyId,
      },
      include: {
        cycle: { select: { id: true, name: true, year: true, half: true, status: true } },
      },
    })

    // Also fetch goals and competencies for the form
    const [goals, competencies] = await Promise.all([
      prisma.mboGoal.findMany({
        where: { cycleId, employeeId: user.employeeId, companyId: user.companyId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, title: true, weight: true, achievementScore: true, status: true },
      }),
      prisma.competencyLibrary.findMany({
        where: {
          OR: [{ companyId: user.companyId }, { companyId: null }],
          isActive: true,
        },
        orderBy: { category: 'asc' },
        select: { id: true, name: true, category: true, description: true },
      }),
    ])

    return apiSuccess({
      evaluation: evaluation
        ? {
            ...evaluation,
            performanceScore: evaluation.performanceScore ? Number(evaluation.performanceScore) : null,
            competencyScore: evaluation.competencyScore ? Number(evaluation.competencyScore) : null,
          }
        : null,
      goals: goals.map((g) => ({
        ...g,
        weight: Number(g.weight),
        achievementScore: g.achievementScore ? Number(g.achievementScore) : null,
      })),
      competencies,
    })
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)

// ─── POST /api/v1/performance/evaluations/self ────────────
// Create or update self-evaluation

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = upsertSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { cycleId, goalScores, competencyScores, overallComment, status } = parsed.data

    // Verify cycle exists, belongs to company, and is in EVAL_OPEN status
    const cycle = await prisma.performanceCycle.findFirst({
      where: { id: cycleId, companyId: user.companyId },
    })
    if (!cycle) throw notFound('유효하지 않은 성과 주기입니다.')
    if (cycle.status !== 'EVAL_OPEN') {
      throw badRequest('현재 평가 기간이 아닙니다.')
    }

    // Calculate performance score (weighted average of goal scores)
    const goals = await prisma.mboGoal.findMany({
      where: { cycleId, employeeId: user.employeeId, companyId: user.companyId },
      select: { id: true, weight: true },
    })

    let performanceScore = 0
    let totalWeight = 0
    for (const gs of goalScores) {
      const goal = goals.find((g) => g.id === gs.goalId)
      if (goal) {
        const w = Number(goal.weight)
        performanceScore += gs.score * w
        totalWeight += w
      }
    }
    performanceScore = totalWeight > 0 ? performanceScore / totalWeight : 0

    // Calculate competency score (simple average)
    const competencyScore =
      competencyScores.length > 0
        ? competencyScores.reduce((sum, cs) => sum + cs.score, 0) / competencyScores.length
        : 0

    // Calculate EMS block
    const emsResult = calculateEmsBlock(performanceScore, competencyScore, DEFAULT_BLOCK_DEFINITIONS)

    try {
      const existing = await prisma.performanceEvaluation.findFirst({
        where: {
          cycleId,
          employeeId: user.employeeId,
          evaluatorId: user.employeeId,
          evalType: 'SELF' as EvalType,
          companyId: user.companyId,
        },
      })

      const evalData = {
        performanceScore,
        competencyScore,
        emsBlock: emsResult.block,
        performanceDetail: goalScores as unknown as Prisma.InputJsonValue,
        competencyDetail: competencyScores as unknown as Prisma.InputJsonValue,
        comment: overallComment ?? null,
        status: status as EvalStatus,
        submittedAt: status === 'SUBMITTED' ? new Date() : null,
      }

      let evaluation
      if (existing) {
        // Cannot edit if already SUBMITTED
        if (existing.status === 'SUBMITTED') {
          throw badRequest('이미 제출된 자기평가는 수정할 수 없습니다.')
        }
        evaluation = await prisma.performanceEvaluation.update({
          where: { id: existing.id },
          data: evalData,
        })
      } else {
        evaluation = await prisma.performanceEvaluation.create({
          data: {
            cycleId,
            employeeId: user.employeeId,
            evaluatorId: user.employeeId,
            evalType: 'SELF' as EvalType,
            companyId: user.companyId,
            ...evalData,
          },
        })
      }

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: `performance.self_eval.${existing ? 'update' : 'create'}`,
        resourceType: 'performanceEvaluation',
        resourceId: evaluation.id,
        companyId: user.companyId,
        changes: { status, performanceScore, competencyScore, emsBlock: emsResult.block },
        ip,
        userAgent,
      })

      // ── Fire-and-forget: PERFORMANCE_SELF_EVAL_SUBMITTED (status=SUBMITTED 일 때만) ──
      if (status === 'SUBMITTED') {
        void eventBus.publish(DOMAIN_EVENTS.PERFORMANCE_SELF_EVAL_SUBMITTED, {
          ctx: {
            companyId:  user.companyId,
            actorId:    user.employeeId,
            occurredAt: new Date(),
          },
          employeeId:       user.employeeId,
          companyId:        user.companyId,
          cycleId,
          evaluationId:     evaluation.id,
          performanceScore: Number(evaluation.performanceScore),
          competencyScore:  Number(evaluation.competencyScore),
        })
      }

      return apiSuccess({
        ...evaluation,
        performanceScore: Number(evaluation.performanceScore),
        competencyScore: Number(evaluation.competencyScore),
      }, existing ? 200 : 201)
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.CREATE),
)
