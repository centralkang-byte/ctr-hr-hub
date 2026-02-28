import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { isAppError, handlePrismaError } from '@/lib/errors'
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
      const companyId = user.companyId
      const now = new Date()
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      // Common: total employees
      const totalEmployees = await prisma.employee.count({
        where: { companyId, status: 'ACTIVE' },
      })

      if (user.role === ROLE.EMPLOYEE) {
        // Employee-specific KPIs
        const leaveBalance = await prisma.employeeLeaveBalance.findMany({
          where: { employeeId: user.employeeId },
          include: { policy: { select: { name: true } } },
        })

        const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const attendanceCount = await prisma.attendance.count({
          where: {
            employeeId: user.employeeId,
            workDate: {
              gte: new Date(`${thisMonth}-01`),
            },
          },
        })

        return apiSuccess({
          role: 'EMPLOYEE',
          totalEmployees,
          leaveBalance: leaveBalance.map((lb) => ({
            policy: lb.policy.name,
            remaining: Number(lb.grantedDays) - Number(lb.usedDays) - Number(lb.pendingDays),
            used: Number(lb.usedDays),
            total: Number(lb.grantedDays),
          })),
          attendanceThisMonth: attendanceCount,
        })
      }

      if (user.role === ROLE.MANAGER) {
        const teamCount = await prisma.employee.count({
          where: { managerId: user.employeeId, companyId, status: 'ACTIVE' },
        })

        const pendingLeaves = await prisma.leaveRequest.count({
          where: {
            companyId,
            status: 'PENDING',
            employee: { managerId: user.employeeId },
          },
        })

        const scheduledOneOnOnes = await prisma.oneOnOne.count({
          where: {
            managerId: user.employeeId,
            companyId,
            status: 'SCHEDULED',
          },
        })

        return apiSuccess({
          role: 'MANAGER',
          totalEmployees,
          teamCount,
          pendingLeaves,
          scheduledOneOnOnes,
        })
      }

      // HR_ADMIN / SUPER_ADMIN
      const newHires = await prisma.employee.count({
        where: {
          companyId,
          hireDate: { gte: thirtyDaysAgo },
        },
      })

      const terminations = await prisma.employee.count({
        where: {
          companyId,
          status: 'TERMINATED',
          updatedAt: { gte: thirtyDaysAgo },
        },
      })

      const turnoverRate =
        totalEmployees > 0
          ? Math.round((terminations / totalEmployees) * 1000) / 10
          : 0

      const openPositions = await prisma.jobPosting.count({
        where: { companyId, status: 'OPEN', deletedAt: null },
      })

      const pendingLeaves = await prisma.leaveRequest.count({
        where: { companyId, status: 'PENDING' },
      })

      return apiSuccess({
        role: user.role,
        totalEmployees,
        newHires,
        terminations,
        turnoverRate,
        openPositions,
        pendingLeaves,
      })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
