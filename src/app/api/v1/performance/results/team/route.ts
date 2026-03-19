// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Team Performance Results (Manager View)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const searchSchema = z.object({
  cycleId: z.string(),
})

// ─── GET /api/v1/performance/results/team ────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = searchSchema.safeParse(params)
    if (!parsed.success) throw badRequest('cycleId 파라미터가 필요합니다.')

    const { cycleId } = parsed.data

    // Get direct reports
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

    const memberIds = teamMembers.map((m) => m.id)

    // Get evaluations for all team members
    const evaluations = await prisma.performanceEvaluation.findMany({
      where: {
        cycleId,
        employeeId: { in: memberIds },
        companyId: user.companyId,
      },
    })

    // Get calibration adjustments
    const adjustments = await prisma.calibrationAdjustment.findMany({
      where: {
        employeeId: { in: memberIds },
        session: { cycleId, companyId: user.companyId },
      },
      orderBy: { adjustedAt: 'desc' },
    })

    const adjMap = new Map<string, typeof adjustments[0]>()
    for (const adj of adjustments) {
      if (!adjMap.has(adj.employeeId)) adjMap.set(adj.employeeId, adj)
    }

    const results = teamMembers.map((member) => {
      const selfEval = evaluations.find((e) => e.employeeId === member.id && e.evalType === 'SELF')
      const managerEval = evaluations.find((e) => e.employeeId === member.id && e.evalType === 'MANAGER')
      const adjustment = adjMap.get(member.id)

      return {
        employee: member,
        selfEval: selfEval
          ? { status: selfEval.status, performanceScore: selfEval.performanceScore ? Number(selfEval.performanceScore) : null, competencyScore: selfEval.competencyScore ? Number(selfEval.competencyScore) : null, emsBlock: selfEval.emsBlock }
          : null,
        managerEval: managerEval
          ? { status: managerEval.status, performanceScore: managerEval.performanceScore ? Number(managerEval.performanceScore) : null, competencyScore: managerEval.competencyScore ? Number(managerEval.competencyScore) : null, emsBlock: managerEval.emsBlock }
          : null,
        finalResult: adjustment
          ? { performanceScore: Number(adjustment.adjustedPerformanceScore), competencyScore: Number(adjustment.adjustedCompetencyScore), emsBlock: adjustment.adjustedBlock, calibrated: true }
          : managerEval
            ? { performanceScore: managerEval.performanceScore ? Number(managerEval.performanceScore) : null, competencyScore: managerEval.competencyScore ? Number(managerEval.competencyScore) : null, emsBlock: managerEval.emsBlock, calibrated: false }
            : null,
      }
    })

    return apiSuccess(results)
  },
  perm(MODULE.PERFORMANCE, ACTION.UPDATE),
)
