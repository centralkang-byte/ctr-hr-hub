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

      const [pendingLeaves, pendingProfileChanges, pendingGoals] =
        await Promise.all([
          prisma.leaveRequest.findMany({
            where: {
              companyId,
              status: 'PENDING',
              employeeId: { in: reportIds },
            },
            include: {
              employee: { select: { name: true, employeeNo: true } },
              policy: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          }),
          prisma.profileChangeRequest.findMany({
            where: {
              employee: {
                assignments: {
                  some: { companyId, isPrimary: true, endDate: null },
                },
              },
              employeeId: { in: reportIds },
              status: 'CHANGE_PENDING',
            },
            include: {
              employee: { select: { name: true, employeeNo: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          }),
          prisma.mboGoal.findMany({
            where: {
              companyId,
              status: 'PENDING_APPROVAL',
              employeeId: { in: reportIds },
            },
            include: {
              employee: { select: { name: true, employeeNo: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          }),
        ])

      return apiSuccess({
        leaves: pendingLeaves.map((lr) => ({
          id: lr.id,
          type: 'LEAVE' as const,
          employeeName: lr.employee.name,
          employeeNo: lr.employee.employeeNo,
          detail: `${lr.policy.name} ${Number(lr.days)}일`,
          startDate: lr.startDate,
          endDate: lr.endDate,
          createdAt: lr.createdAt,
        })),
        profileChanges: pendingProfileChanges.map((pc) => ({
          id: pc.id,
          type: 'PROFILE_CHANGE' as const,
          employeeName: pc.employee.name,
          employeeNo: pc.employee.employeeNo,
          detail: `${pc.fieldName}: ${pc.oldValue ?? '-'} → ${pc.newValue}`,
          createdAt: pc.createdAt,
        })),
        goals: pendingGoals.map((g) => ({
          id: g.id,
          type: 'MBO_GOAL' as const,
          employeeName: g.employee.name,
          employeeNo: g.employee.employeeNo,
          detail: g.title,
          weight: Number(g.weight),
          createdAt: g.createdAt,
        })),
        totalCount:
          pendingLeaves.length +
          pendingProfileChanges.length +
          pendingGoals.length,
      })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
