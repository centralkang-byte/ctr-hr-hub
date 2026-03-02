// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Manager Evaluation UPSERT
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError, notFound, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants' // DEFAULT_PAGE/SIZE used in searchSchema
import { calculateEmsBlock, DEFAULT_BLOCK_DEFINITIONS } from '@/lib/ems'
import type { SessionUser } from '@/types'
import type { EvalType, EvalStatus, Prisma } from '@/generated/prisma/client'

// ─── Schemas ──────────────────────────────────────────────

const searchSchema = z.object({
  cycleId: z.string().cuid(),
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
})

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
  cycleId: z.string().cuid(),
  employeeId: z.string(),
  goalScores: z.array(goalScoreSchema),
  competencyScores: z.array(competencyScoreSchema),
  performanceGrade: z.string().max(20).optional(),
  competencyGrade: z.string().max(20).optional(),
  beiIndicatorScores: z.array(z.object({
    indicatorId: z.string(),
    checked: z.boolean(),
  })).optional().default([]),
  overallComment: z.string().max(3000).optional(),
  status: z.enum(['DRAFT', 'SUBMITTED']),
})

// ─── GET /api/v1/performance/evaluations/manager ──────────
// List team members' evaluations for a cycle (manager view)

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = searchSchema.safeParse(params)
    if (!parsed.success) throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })

    const { cycleId, page, limit } = parsed.data

    // Get team members (direct reports)
    // TODO: implement proper manager hierarchy via position reportsTo
    const teamMembers = await prisma.employee.findMany({
      where: {
        assignments: {
          some: { companyId: user.companyId, status: 'ACTIVE', isPrimary: true, endDate: null },
        },
      },
      select: {
        id: true, name: true, employeeNo: true,
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          include: {
            department: { select: { name: true } },
            jobGrade: { select: { name: true } },
          },
        },
      },
    })

    const teamMemberIds = teamMembers.map((m) => m.id)

    const where = {
      cycleId,
      employeeId: { in: teamMemberIds },
      companyId: user.companyId,
    }

    const [evaluations, total] = await Promise.all([
      prisma.performanceEvaluation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
        },
      }),
      prisma.performanceEvaluation.count({ where }),
    ])

    // Map evaluations by employee for easy lookup
    const evalMap = new Map<string, { self: typeof evaluations[0] | null; manager: typeof evaluations[0] | null }>()
    for (const ev of evaluations) {
      const existing = evalMap.get(ev.employeeId) ?? { self: null, manager: null }
      if (ev.evalType === 'SELF') existing.self = ev
      if (ev.evalType === 'MANAGER') existing.manager = ev
      evalMap.set(ev.employeeId, existing)
    }

    const result = teamMembers.map((member) => {
      const evals = evalMap.get(member.id)
      return {
        employee: member,
        selfEval: evals?.self
          ? { id: evals.self.id, status: evals.self.status, performanceScore: evals.self.performanceScore ? Number(evals.self.performanceScore) : null, competencyScore: evals.self.competencyScore ? Number(evals.self.competencyScore) : null }
          : null,
        managerEval: evals?.manager
          ? { id: evals.manager.id, status: evals.manager.status, performanceScore: evals.manager.performanceScore ? Number(evals.manager.performanceScore) : null, competencyScore: evals.manager.competencyScore ? Number(evals.manager.competencyScore) : null }
          : null,
      }
    })

    // 평가 설정 로드
    const { getCompanySettings } = await import('@/lib/settings/getSettings')
    const settingsRes = await getCompanySettings('evaluationSetting', user.companyId)
    const evalSettings = settingsRes.data

    // BEI 지표 로드 (methodology = MBO_BEI 일 때만)
    let beiIndicators: Array<{
      competencyId: string
      competencyName: string
      indicators: Array<{ id: string; indicatorText: string; displayOrder: number }>
    }> = []

    if (evalSettings?.methodology === 'MBO_BEI') {
      const coreValueComps = await prisma.competency.findMany({
        where: { category: { code: 'core_value' }, isActive: true },
        orderBy: { displayOrder: 'asc' },
        include: {
          indicators: {
            where: { isActive: true },
            orderBy: { displayOrder: 'asc' },
            select: { id: true, indicatorText: true, displayOrder: true },
          },
        },
      })
      beiIndicators = coreValueComps.map((c) => ({
        competencyId: c.id,
        competencyName: c.name,
        indicators: c.indicators,
      }))
    }

    return apiSuccess({ members: result, evalSettings, beiIndicators })
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)

// ─── POST /api/v1/performance/evaluations/manager ─────────
// Create or update manager evaluation for a team member

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = upsertSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { cycleId, employeeId, goalScores, competencyScores, overallComment, status } = parsed.data

    // Verify cycle
    const cycle = await prisma.performanceCycle.findFirst({
      where: { id: cycleId, companyId: user.companyId },
    })
    if (!cycle) throw notFound('유효하지 않은 성과 주기입니다.')
    if (cycle.status !== 'EVAL_OPEN') throw badRequest('현재 평가 기간이 아닙니다.')

    // Verify the target employee is in the same company
    // TODO: implement proper manager hierarchy via position reportsTo
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        assignments: {
          some: { companyId: user.companyId, isPrimary: true, endDate: null },
        },
      },
    })
    if (!employee) throw forbidden('해당 직원의 매니저가 아닙니다.')

    // Calculate performance score
    const goals = await prisma.mboGoal.findMany({
      where: { cycleId, employeeId, companyId: user.companyId },
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

    // Calculate competency score
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
          employeeId,
          evaluatorId: user.employeeId,
          evalType: 'MANAGER' as EvalType,
          companyId: user.companyId,
        },
      })

      const evalData = {
        performanceScore,
        competencyScore,
        emsBlock: emsResult.block,
        performanceDetail: {
          goalScores,
          gradeCode: parsed.data.performanceGrade ?? null,
        } as unknown as Prisma.InputJsonValue,
        competencyDetail: {
          competencyScores: parsed.data.competencyScores,
          beiIndicatorScores: parsed.data.beiIndicatorScores,
          gradeCode: parsed.data.competencyGrade ?? null,
        } as unknown as Prisma.InputJsonValue,
        performanceGrade: parsed.data.performanceGrade ?? null,
        competencyGrade: parsed.data.competencyGrade ?? null,
        comment: overallComment ?? null,
        status: status as EvalStatus,
        submittedAt: status === 'SUBMITTED' ? new Date() : null,
      }

      let evaluation
      if (existing) {
        if (existing.status === 'SUBMITTED') {
          throw badRequest('이미 제출된 평가는 수정할 수 없습니다.')
        }
        evaluation = await prisma.performanceEvaluation.update({
          where: { id: existing.id },
          data: evalData,
        })
      } else {
        evaluation = await prisma.performanceEvaluation.create({
          data: {
            cycleId,
            employeeId,
            evaluatorId: user.employeeId,
            evalType: 'MANAGER' as EvalType,
            companyId: user.companyId,
            ...evalData,
          },
        })
      }

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: `performance.manager_eval.${existing ? 'update' : 'create'}`,
        resourceType: 'performanceEvaluation',
        resourceId: evaluation.id,
        companyId: user.companyId,
        changes: { employeeId, status, performanceScore, competencyScore, emsBlock: emsResult.block },
        ip,
        userAgent,
      })

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
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
