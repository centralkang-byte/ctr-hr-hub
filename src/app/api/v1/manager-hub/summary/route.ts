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

      // Headcount
      const headcount = await prisma.employee.count({
        where: { managerId, companyId, status: 'ACTIVE' },
      })

      // Attrition risk (employees with high risk score)
      const highRiskCount = await prisma.employee.count({
        where: {
          managerId,
          companyId,
          status: 'ACTIVE',
          attritionRiskScore: { gte: 70 },
        },
      })

      // Average overtime this month
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const teamMembers = await prisma.employee.findMany({
        where: { managerId, companyId, status: 'ACTIVE' },
        select: { id: true },
      })
      const teamIds = teamMembers.map((m) => m.id)

      const overtimeRecords = await prisma.attendance.findMany({
        where: {
          employeeId: { in: teamIds },
          workDate: { gte: monthStart },
          overtimeMinutes: { gt: 0 },
        },
        select: { overtimeMinutes: true },
      })
      const totalOvertime = overtimeRecords.reduce(
        (sum, r) => sum + (r.overtimeMinutes ?? 0),
        0,
      )
      const avgOvertimeHours =
        teamIds.length > 0
          ? Math.round((totalOvertime / teamIds.length / 60) * 10) / 10
          : 0

      // Incomplete 1:1s this month
      const incompleteOneOnOnes = await prisma.oneOnOne.count({
        where: {
          managerId,
          companyId,
          status: 'SCHEDULED',
          scheduledAt: { gte: monthStart, lte: now },
        },
      })

      return apiSuccess({
        headcount,
        attritionRisk: highRiskCount,
        avgOvertimeHours,
        incompleteOneOnOnes,
      })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
