import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { withCache, CACHE_STRATEGY } from '@/lib/cache'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withCache(withPermission(
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
      const totalEmployees = await prisma.employeeAssignment.count({
        where: { companyId, status: 'ACTIVE', isPrimary: true, endDate: null },
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
        // 2-step: find manager's positionId, then count direct reports
        const managerAsgn = await prisma.employeeAssignment.findFirst({
          where: { employeeId: user.employeeId, isPrimary: true, endDate: null },
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

        const teamCount = await prisma.employee.count({
          where: {
            id: { in: reportIds },
            assignments: {
              some: { companyId, status: 'ACTIVE', isPrimary: true, endDate: null },
            },
          },
        })

        const pendingLeaves = await prisma.leaveRequest.count({
          where: {
            companyId,
            status: 'PENDING',
            employeeId: { in: reportIds },
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

      // HR_ADMIN / SUPER_ADMIN — 4 independent count queries parallelized
      const [newHires, terminations, openPositions, pendingLeaves] = await Promise.all([
        prisma.employee.count({
          where: {
            hireDate: { gte: thirtyDaysAgo },
            assignments: {
              some: { companyId, isPrimary: true, endDate: null },
            },
          },
        }),
        prisma.employeeAssignment.count({
          where: {
            companyId,
            status: 'TERMINATED',
            isPrimary: true,
            updatedAt: { gte: thirtyDaysAgo },
          },
        }),
        prisma.jobPosting.count({
          where: { companyId, status: 'OPEN', deletedAt: null },
        }),
        prisma.leaveRequest.count({
          where: { companyId, status: 'PENDING' },
        }),
      ])

      const turnoverRate =
        totalEmployees > 0
          ? Math.round((terminations / totalEmployees) * 1000) / 10
          : 0

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
), CACHE_STRATEGY.DASHBOARD_KPI)
