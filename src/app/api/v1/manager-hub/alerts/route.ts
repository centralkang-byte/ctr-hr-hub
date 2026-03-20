import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, isAppError, handlePrismaError, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { getCrossCompanyReadFilter } from '@/lib/api/cross-company-access'
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
      if (user.role === ROLE.EMPLOYEE) throw forbidden('매니저 이상만 접근 가능합니다.')
      const params = Object.fromEntries(req.nextUrl.searchParams.entries())
      const parsed = managerAlertsSchema.safeParse(params)
      if (!parsed.success) {
        throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
      }

      const companyId = user.companyId
      const managerId = user.employeeId
      const { limit } = parsed.data

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

      // Cross-company: include employees from secondary/dotted-line relationships
      const crossCompanyFilter = await getCrossCompanyReadFilter({
        callerEmployeeId: managerId,
        callerRole: user.role,
        callerCompanyId: companyId,
      })
      const crossCompanyIds: string[] = crossCompanyFilter
        ? await prisma.employee.findMany({
            where: crossCompanyFilter,
            select: { id: true },
          }).then((rows) => rows.map((r) => r.id))
        : []
      const allReportIds = [...new Set([...reportIds, ...crossCompanyIds])]

      const teamMembers = await prisma.employee.findMany({
        where: {
          id: { in: allReportIds },
          assignments: {
            some: { status: 'ACTIVE', isPrimary: true, endDate: null },
          },
        },
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

      // Burnout risk — batch fetch attendance + leave to eliminate N+1
      const [burnoutAttendance, approvedLeaves] = await Promise.all([
        prisma.attendance.findMany({
          where: {
            employeeId: { in: teamIds },
            workDate: { gte: monthStart },
            overtimeMinutes: { gt: 60 },
          },
          select: { employeeId: true },
        }),
        prisma.leaveRequest.findMany({
          where: {
            employeeId: { in: teamIds },
            status: 'APPROVED',
            startDate: { gte: monthStart },
          },
          select: { employeeId: true },
        }),
      ])

      const burnoutOvertimeCount = new Map<string, number>()
      for (const r of burnoutAttendance) {
        burnoutOvertimeCount.set(r.employeeId, (burnoutOvertimeCount.get(r.employeeId) ?? 0) + 1)
      }
      const hasLeaveSet = new Set(approvedLeaves.map((l) => l.employeeId))

      for (const empId of teamIds) {
        const overtimeDays = burnoutOvertimeCount.get(empId) ?? 0
        if (overtimeDays > 15 && !hasLeaveSet.has(empId)) {
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
