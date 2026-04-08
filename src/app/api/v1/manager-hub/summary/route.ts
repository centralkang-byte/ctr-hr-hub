import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { getCrossCompanyReadFilter } from '@/lib/api/cross-company-access'
import { getDirectReportIds } from '@/lib/employee/direct-reports'
import type { SessionUser } from '@/types'

// ─── Helpers ────────────────────────────────────────────────

type MemberStatus = 'PRESENT' | 'LEAVE' | 'HALF_DAY' | 'VACATION' | 'ABSENT'

function resolveMemberStatus(
  employeeId: string,
  attendanceMap: Map<string, boolean>,
  leaveMap: Map<string, { isHalfDay: boolean; days: number }>,
): MemberStatus {
  const hasAttendance = attendanceMap.has(employeeId)
  const leave = leaveMap.get(employeeId)

  if (leave) {
    if (leave.isHalfDay) return 'HALF_DAY'
    // Multi-day leave (2+ days) → VACATION, single full-day → LEAVE
    return leave.days >= 2 ? 'VACATION' : 'LEAVE'
  }
  return hasAttendance ? 'PRESENT' : 'ABSENT'
}

// ─── Route ──────────────────────────────────────────────────

export const GET = withPermission(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const companyId = user.companyId
      const managerId = user.employeeId
      const includeMembers = req.nextUrl.searchParams.get('includeMembers') === 'true'

      // Position 기반 직속 보고라인 (primary + secondary 모두 지원)
      const reportIds = await getDirectReportIds(managerId)

      // teamName용 primary 부서명 조회
      const managerAsgn = await prisma.employeeAssignment.findFirst({
        where: { employeeId: managerId, isPrimary: true, endDate: null },
        select: { position: { select: { department: { select: { name: true } } } } },
      })

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

      // Headcount
      const headcount = await prisma.employee.count({
        where: {
          id: { in: allReportIds },
          assignments: {
            some: { status: 'ACTIVE', isPrimary: true, endDate: null },
          },
        },
      })

      // Attrition risk (employees with high risk score)
      const highRiskCount = await prisma.employee.count({
        where: {
          id: { in: allReportIds },
          assignments: {
            some: { status: 'ACTIVE', isPrimary: true, endDate: null },
          },
          attritionRiskScore: { gte: 70 },
        },
      })

      // Average overtime this month
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const teamMembers = await prisma.employee.findMany({
        where: {
          id: { in: allReportIds },
          assignments: {
            some: { status: 'ACTIVE', isPrimary: true, endDate: null },
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

      const base = {
        headcount,
        attritionRisk: highRiskCount,
        avgOvertimeHours,
        incompleteOneOnOnes,
      }

      if (!includeMembers) {
        return apiSuccess(base)
      }

      // ── Extended: members + pendingApprovals for TeamPresence ──

      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const todayEnd = new Date(todayStart)
      todayEnd.setDate(todayEnd.getDate() + 1)

      const [memberRows, todayAttendance, todayLeaves, pendingLeaves] = await Promise.all([
        // Team members with name + position title
        prisma.employee.findMany({
          where: {
            id: { in: allReportIds },
            assignments: { some: { status: 'ACTIVE', isPrimary: true, endDate: null } },
          },
          select: {
            id: true,
            name: true,
            assignments: {
              where: { isPrimary: true, endDate: null },
              select: { position: { select: { titleKo: true } } },
              take: 1,
            },
          },
        }),
        // Today's attendance records
        prisma.attendance.findMany({
          where: {
            employeeId: { in: allReportIds },
            workDate: { gte: todayStart, lt: todayEnd },
          },
          select: { employeeId: true },
        }),
        // Approved leaves overlapping today
        prisma.leaveRequest.findMany({
          where: {
            employeeId: { in: allReportIds },
            status: 'APPROVED',
            startDate: { lt: todayEnd },
            endDate: { gte: todayStart },
          },
          select: { employeeId: true, days: true },
        }),
        // Pending leave requests for approval list (no companyId filter — cross-company reports included)
        prisma.leaveRequest.findMany({
          where: {
            status: 'PENDING',
            employeeId: { in: allReportIds },
          },
          include: {
            employee: { select: { name: true } },
            policy: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ])

      // Build lookup maps
      const attendanceMap = new Map<string, boolean>()
      for (const a of todayAttendance) attendanceMap.set(a.employeeId, true)

      const leaveMap = new Map<string, { isHalfDay: boolean; days: number }>()
      for (const lr of todayLeaves) {
        const days = Number(lr.days)
        const existing = leaveMap.get(lr.employeeId)
        if (existing) {
          // Accumulate: two half-day leaves = full day
          const totalDays = existing.days + days
          leaveMap.set(lr.employeeId, { isHalfDay: totalDays < 1, days: totalDays })
        } else {
          leaveMap.set(lr.employeeId, { isHalfDay: days < 1, days })
        }
      }

      const members = memberRows.map((emp) => ({
        id: emp.id,
        name: emp.name,
        position: emp.assignments[0]?.position?.titleKo ?? '',
        status: resolveMemberStatus(emp.id, attendanceMap, leaveMap),
      }))

      const presentCount = members.filter((m) => m.status === 'PRESENT' || m.status === 'HALF_DAY').length
      const attendanceRate = members.length > 0
        ? Math.round((presentCount / members.length) * 100)
        : 0

      return apiSuccess({
        ...base,
        teamCount: headcount,
        teamName: managerAsgn?.position?.department?.name ?? undefined,
        attendanceRate,
        members,
        pendingApprovals: pendingLeaves.map((lr) => ({
          id: lr.id,
          employeeName: lr.employee.name,
          type: 'LEAVE',
          summary: `${lr.policy.name} ${Number(lr.days)}일`,
          sourceId: lr.id,
        })),
      })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
