import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { withCache, CACHE_STRATEGY } from '@/lib/cache'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { getDirectReportIds } from '@/lib/employee/direct-reports'
import type { SessionUser } from '@/types'

// ─── Helpers ────────────────────────────────────────────────

function getCurrentQuarter(now: Date): { year: number; quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4' } {
  const q = Math.ceil((now.getMonth() + 1) / 3) as 1 | 2 | 3 | 4
  return { year: now.getFullYear(), quarter: `Q${q}` as 'Q1' | 'Q2' | 'Q3' | 'Q4' }
}

function aggregateQrStats(groups: { status: string; _count: { _all: number } }[]) {
  let total = 0
  let completed = 0
  for (const g of groups) {
    total += g._count._all
    if (g.status === 'COMPLETED') completed += g._count._all
  }
  return { total, completed, pending: total - completed }
}

// ─── Route ──────────────────────────────────────────────────

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
      const { year: qrYear, quarter: qrQuarter } = getCurrentQuarter(now)

      // Common: total employees
      const totalEmployees = await prisma.employeeAssignment.count({
        where: { companyId, status: 'ACTIVE', isPrimary: true, endDate: null },
      })

      if (user.role === ROLE.EMPLOYEE) {
        const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

        const [leaveBalance, attendanceCount, qrReview] = await Promise.all([
          prisma.employeeLeaveBalance.findMany({
            where: { employeeId: user.employeeId },
            include: { policy: { select: { name: true, leaveType: true } } },
          }),
          prisma.attendance.count({
            where: {
              employeeId: user.employeeId,
              workDate: { gte: new Date(`${thisMonth}-01`) },
            },
          }),
          prisma.quarterlyReview.findFirst({
            where: { employeeId: user.employeeId, year: qrYear, quarter: qrQuarter },
            select: { id: true, status: true },
          }),
        ])

        return apiSuccess({
          role: 'EMPLOYEE',
          totalEmployees,
          leaveBalance: leaveBalance.map((lb) => ({
            policy: lb.policy.name,
            leaveType: lb.policy.leaveType,
            remaining: Number(lb.grantedDays) - Number(lb.usedDays) - Number(lb.pendingDays),
            used: Number(lb.usedDays),
            total: Number(lb.grantedDays),
          })),
          attendanceThisMonth: attendanceCount,
          quarterlyReview: qrReview
            ? { id: qrReview.id, status: qrReview.status }
            : { id: null, status: null },
        })
      }

      if (user.role === ROLE.MANAGER) {
        // C-1 fix: canonical helper (includes secondary assignments)
        const reportIds = await getDirectReportIds(user.employeeId)
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

        const [teamCount, pendingLeaves, overdueLeaves, scheduledOneOnOnes, qrGroups] = await Promise.all([
          prisma.employee.count({
            where: {
              id: { in: reportIds },
              assignments: {
                some: { companyId, status: 'ACTIVE', isPrimary: true, endDate: null },
              },
            },
          }),
          prisma.leaveRequest.count({
            where: { companyId, status: 'PENDING', employeeId: { in: reportIds } },
          }),
          // Overdue: PENDING leaves whose startDate is strictly before today
          prisma.leaveRequest.count({
            where: {
              companyId,
              status: 'PENDING',
              employeeId: { in: reportIds },
              startDate: { lt: todayStart },
            },
          }),
          prisma.oneOnOne.count({
            where: { managerId: user.employeeId, companyId, status: 'SCHEDULED' },
          }),
          // H-1 fix: single groupBy query for QR stats
          prisma.quarterlyReview.groupBy({
            by: ['status'],
            where: { employeeId: { in: reportIds }, year: qrYear, quarter: qrQuarter },
            _count: { _all: true },
          }),
        ])

        return apiSuccess({
          role: 'MANAGER',
          totalEmployees,
          teamCount,
          pendingLeaves,
          overdueLeaves,
          scheduledOneOnOnes,
          quarterlyReviewStats: aggregateQrStats(qrGroups),
        })
      }

      // HR_ADMIN / SUPER_ADMIN
      const [newHires, terminations, openPositions, pendingLeaves, qrGroups] = await Promise.all([
        prisma.employee.count({
          where: {
            hireDate: { gte: thirtyDaysAgo },
            assignments: { some: { companyId, isPrimary: true, endDate: null } },
          },
        }),
        prisma.employeeAssignment.count({
          where: { companyId, status: 'TERMINATED', isPrimary: true, updatedAt: { gte: thirtyDaysAgo } },
        }),
        prisma.jobPosting.count({
          where: { companyId, status: 'OPEN', deletedAt: null },
        }),
        prisma.leaveRequest.count({
          where: { companyId, status: 'PENDING' },
        }),
        prisma.quarterlyReview.groupBy({
          by: ['status'],
          where: { companyId, year: qrYear, quarter: qrQuarter },
          _count: { _all: true },
        }),
      ])

      const turnoverRate =
        totalEmployees > 0
          ? Math.round((terminations / totalEmployees) * 1000) / 10
          : 0

      const qrStats = aggregateQrStats(qrGroups)

      return apiSuccess({
        role: user.role,
        totalEmployees,
        newHires,
        terminations,
        turnoverRate,
        openPositions,
        pendingLeaves,
        quarterlyReviewStats: {
          ...qrStats,
          completionRate: qrStats.total > 0
            ? Math.round((qrStats.completed / qrStats.total) * 100)
            : 0,
        },
      })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
), CACHE_STRATEGY.DASHBOARD_KPI, 'user')
