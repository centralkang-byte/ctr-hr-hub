import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { isAppError, handlePrismaError, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (
    _req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      if (user.role === ROLE.EMPLOYEE) throw forbidden('매니저 이상만 접근 가능합니다.')
      const companyId = user.companyId
      const managerId = user.employeeId

      // 2-step: find manager's positionId, then find direct reports via position hierarchy
      const managerAsgn = await prisma.employeeAssignment.findFirst({
        where: { employeeId: managerId, isPrimary: true, endDate: null },
        select: { positionId: true },
      })
      const directReportAsgnList = managerAsgn?.positionId
        ? await prisma.employeeAssignment.findMany({
            where: {
              position: { reportsToPositionId: managerAsgn.positionId },
              isPrimary: true,
              endDate: null,
            },
            select: { employeeId: true },
          })
        : []
      const reportIds = directReportAsgnList.map((a: any) => a.employeeId) // eslint-disable-line @typescript-eslint/no-explicit-any

      // Headcount
      const headcount = await prisma.employee.count({
        where: {
          id: { in: reportIds },
          assignments: {
            some: { companyId, status: 'ACTIVE', isPrimary: true, endDate: null },
          },
        },
      })

      // Attrition risk (employees with high risk score)
      const highRiskCount = await prisma.employee.count({
        where: {
          id: { in: reportIds },
          assignments: {
            some: { companyId, status: 'ACTIVE', isPrimary: true, endDate: null },
          },
          attritionRiskScore: { gte: 70 },
        },
      })

      // Average overtime this month
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
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
