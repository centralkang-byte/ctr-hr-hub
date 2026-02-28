import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { managerAlertsSchema } from '@/lib/schemas/manager-hub'
import type { SessionUser } from '@/types'

interface Alert {
  id: string
  type: 'ATTRITION_RISK' | 'OVERTIME' | 'BURNOUT'
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  employeeName: string
  employeeId: string
  message: string
  createdAt: Date
}

export const GET = withPermission(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const params = Object.fromEntries(req.nextUrl.searchParams.entries())
      const parsed = managerAlertsSchema.safeParse(params)
      if (!parsed.success) {
        throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
      }

      const companyId = user.companyId
      const managerId = user.employeeId
      const { limit } = parsed.data

      const teamMembers = await prisma.employee.findMany({
        where: { managerId, companyId, status: 'ACTIVE' },
        select: { id: true, name: true },
      })
      const teamMap = new Map(teamMembers.map((m) => [m.id, m.name]))
      const teamIds = teamMembers.map((m) => m.id)

      const alerts: Alert[] = []
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      // Overtime alerts - employees exceeding weekly limits
      const overtimeRecords = await prisma.attendance.findMany({
        where: {
          employeeId: { in: teamIds },
          workDate: { gte: monthStart },
        },
        select: { employeeId: true, overtimeMinutes: true },
      })

      const overtimeByEmployee = new Map<string, number>()
      for (const r of overtimeRecords) {
        const curr = overtimeByEmployee.get(r.employeeId) ?? 0
        overtimeByEmployee.set(r.employeeId, curr + (r.overtimeMinutes ?? 0))
      }

      const weeks = Math.max(
        1,
        Math.ceil(
          (now.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24 * 7),
        ),
      )

      for (const [empId, totalMin] of overtimeByEmployee) {
        const weeklyHours = totalMin / 60 / weeks
        if (weeklyHours > 12) {
          alerts.push({
            id: `overtime-${empId}`,
            type: 'OVERTIME',
            severity: weeklyHours > 20 ? 'HIGH' : 'MEDIUM',
            employeeName: teamMap.get(empId) ?? '',
            employeeId: empId,
            message: `주간 초과근무 ${weeklyHours.toFixed(1)}시간 (기준 12시간)`,
            createdAt: now,
          })
        }
      }

      // Burnout risk - consecutive days with overtime + no leave taken
      for (const empId of teamIds) {
        const recentAttendance = await prisma.attendance.findMany({
          where: {
            employeeId: empId,
            workDate: { gte: monthStart },
            overtimeMinutes: { gt: 60 },
          },
        })

        const recentLeave = await prisma.leaveRequest.count({
          where: {
            employeeId: empId,
            status: 'APPROVED',
            startDate: { gte: monthStart },
          },
        })

        if (recentAttendance.length > 15 && recentLeave === 0) {
          alerts.push({
            id: `burnout-${empId}`,
            type: 'BURNOUT',
            severity: 'MEDIUM',
            employeeName: teamMap.get(empId) ?? '',
            employeeId: empId,
            message: '이번 달 연속 초과근무 + 휴가 미사용',
            createdAt: now,
          })
        }
      }

      // Sort by severity
      const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 }
      alerts.sort(
        (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
      )

      return apiSuccess(alerts.slice(0, limit))
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
