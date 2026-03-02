// ═══════════════════════════════════════════════════════════
// CTR HR Hub — My Performance Results
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/performance/results/me ──────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const cycleId = req.nextUrl.searchParams.get('cycleId')
    if (!cycleId) throw badRequest('cycleId 파라미터가 필요합니다.')

    // Get all evaluations for this user in this cycle
    const evaluations = await prisma.performanceEvaluation.findMany({
      where: {
        cycleId,
        employeeId: user.employeeId,
        companyId: user.companyId,
      },
      include: {
        evaluator: { select: { id: true, name: true } },
        cycle: { select: { id: true, name: true, year: true, half: true, status: true } },
      },
    })

    // Get goals
    const goals = await prisma.mboGoal.findMany({
      where: { cycleId, employeeId: user.employeeId, companyId: user.companyId },
      orderBy: { createdAt: 'asc' },
    })

    // Get calibration adjustments if any
    const adjustments = await prisma.calibrationAdjustment.findMany({
      where: { employeeId: user.employeeId, session: { cycleId, companyId: user.companyId } },
      orderBy: { adjustedAt: 'desc' },
      take: 1,
    })

    const selfEval = evaluations.find((e) => e.evalType === 'SELF')
    const managerEval = evaluations.find((e) => e.evalType === 'MANAGER')
    const latestAdjustment = adjustments[0] ?? null

    return apiSuccess({
      cycle: evaluations[0]?.cycle ?? null,
      selfEvaluation: selfEval
        ? {
            ...selfEval,
            performanceScore: selfEval.performanceScore ? Number(selfEval.performanceScore) : null,
            competencyScore: selfEval.competencyScore ? Number(selfEval.competencyScore) : null,
          }
        : null,
      managerEvaluation: managerEval
        ? {
            ...managerEval,
            performanceScore: managerEval.performanceScore ? Number(managerEval.performanceScore) : null,
            competencyScore: managerEval.competencyScore ? Number(managerEval.competencyScore) : null,
          }
        : null,
      finalResult: latestAdjustment
        ? {
            performanceScore: Number(latestAdjustment.adjustedPerformanceScore),
            competencyScore: Number(latestAdjustment.adjustedCompetencyScore),
            emsBlock: latestAdjustment.adjustedBlock,
            calibrated: true,
          }
        : managerEval
          ? {
              performanceScore: managerEval.performanceScore ? Number(managerEval.performanceScore) : null,
              competencyScore: managerEval.competencyScore ? Number(managerEval.competencyScore) : null,
              emsBlock: managerEval.emsBlock,
              calibrated: false,
            }
          : null,
      goals: goals.map((g) => ({
        ...g,
        weight: Number(g.weight),
        achievementScore: g.achievementScore ? Number(g.achievementScore) : null,
      })),
    })
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
