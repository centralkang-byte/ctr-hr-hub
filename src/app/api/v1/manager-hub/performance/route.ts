import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (
    _req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const companyId = user.companyId
      const managerId = user.employeeId

      // 2-step: find manager's positionId, then find direct reports via position hierarchy
      const managerAsgn = await prisma.employeeAssignment.findFirst({
        where: { employeeId: managerId, isPrimary: true, endDate: null },
        select: { positionId: true },
      })
      const directReportAsgnList: { employeeId: string }[] = managerAsgn?.positionId
        ? await prisma.employeeAssignment.findMany({
            where: {
              position: { reportsToPositionId: managerAsgn.positionId },
              isPrimary: true,
              endDate: null,
            },
            select: { employeeId: true },
          })
        : []
      const reportIds = directReportAsgnList.map((a) => a.employeeId)

      const teamMembers = await prisma.employee.findMany({
        where: {
          id: { in: reportIds },
          assignments: {
            some: { companyId, status: 'ACTIVE', isPrimary: true, endDate: null },
          },
        },
        select: { id: true },
      })
      const teamIds = teamMembers.map((m) => m.id)

      // Latest cycle
      const latestCycle = await prisma.performanceCycle.findFirst({
        where: { companyId },
        orderBy: { year: 'desc' },
      })

      if (!latestCycle) {
        return apiSuccess({
          cycleId: null,
          cycleName: null,
          gradeDistribution: [],
          mboAchievement: { average: 0, count: 0 },
        })
      }

      // Grade distribution from evaluations
      const evaluations = await prisma.performanceEvaluation.findMany({
        where: {
          cycleId: latestCycle.id,
          employeeId: { in: teamIds },
          evalType: 'MANAGER',
          status: 'SUBMITTED',
        },
        select: { emsBlock: true },
      })

      const gradeMap = new Map<string, number>()
      for (const e of evaluations) {
        const grade = e.emsBlock ?? 'N/A'
        gradeMap.set(grade, (gradeMap.get(grade) ?? 0) + 1)
      }
      const gradeDistribution = Array.from(gradeMap.entries()).map(
        ([grade, count]) => ({ grade, count }),
      )

      // MBO achievement
      const goals = await prisma.mboGoal.findMany({
        where: {
          cycleId: latestCycle.id,
          employeeId: { in: teamIds },
          status: 'APPROVED',
          achievementScore: { not: null },
        },
        select: { achievementScore: true },
      })

      const avgAchievement =
        goals.length > 0
          ? Math.round(
              (goals.reduce(
                (sum, g) => sum + Number(g.achievementScore),
                0,
              ) /
                goals.length) *
                10,
            ) / 10
          : 0

      return apiSuccess({
        cycleId: latestCycle.id,
        cycleName: latestCycle.name,
        gradeDistribution,
        mboAchievement: {
          average: avgAchievement,
          count: goals.length,
        },
      })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
