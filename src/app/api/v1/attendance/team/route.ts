// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Team Attendance API (Manager View)
// GET /api/v1/attendance/team
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { forbidden } from '@/lib/errors'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { formatToTz, parseDateOnly } from '@/lib/timezone'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    // 팀 근태는 매니저 이상 — EMPLOYEE의 부서원 출퇴근 시각 열람 차단 (att-04)
    if (user.role === ROLE.EMPLOYEE) {
      throw forbidden('팀 근태 조회 권한이 없습니다.')
    }

    // 1. Get manager's department
    const manager = await prisma.employee.findUnique({
      where: { id: user.employeeId },
      select: {
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          select: { departmentId: true },
        },
      },
    })

    // 오늘 날짜 — workDate는 "KST 날짜의 UTC 자정"으로 저장되므로 KST 달력 날짜 기준 (att-06)
    const dateStr = formatToTz(new Date(), 'Asia/Seoul', 'yyyy-MM-dd')
    const today = parseDateOnly(dateStr)
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

    const managerPrimary = extractPrimaryAssignment(manager?.assignments ?? [])
    const managerDepartmentId = managerPrimary?.departmentId
    if (!managerDepartmentId) {
      return apiSuccess({ date: dateStr, members: [] })
    }

    // 3. Get all team members in the same department
    const teamMembers = await prisma.employee.findMany({
      where: {
        deletedAt: null,
        assignments: {
          some: {
            departmentId: managerDepartmentId,
            companyId: user.companyId,
            isPrimary: true,
            endDate: null,
          },
        },
      },
      select: {
        id: true,
        employeeNo: true,
        name: true,
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          select: { jobGrade: { select: { name: true } } },
        },
      },
      orderBy: { name: 'asc' },
    })

    if (teamMembers.length === 0) {
      return apiSuccess({ date: dateStr, members: [] })
    }

    // 4. Get today's attendance for all team members
    const employeeIds = teamMembers.map((emp) => emp.id)
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        employeeId: { in: employeeIds },
        companyId: user.companyId,
        workDate: { gte: today, lt: tomorrow },
      },
    })

    // 5. Build attendance lookup map
    const attendanceMap = new Map(
      attendanceRecords.map((a) => [a.employeeId, a]),
    )

    // 6. Combine and return
    const members = teamMembers.map((emp) => {
      const attendance = attendanceMap.get(emp.id) ?? null
      return {
        employeeId: emp.id,
        employeeNo: emp.employeeNo,
        name: emp.name,
        position: extractPrimaryAssignment(emp.assignments)?.jobGrade?.name ?? '',
        attendance: attendance
          ? {
              id: attendance.id,
              clockIn: attendance.clockIn,
              clockOut: attendance.clockOut,
              status: attendance.status,
              workType: attendance.workType,
              totalMinutes: attendance.totalMinutes,
            }
          : null,
        isClockedIn: !!(attendance?.clockIn && !attendance?.clockOut),
      }
    })

    return apiSuccess({
      date: dateStr,
      members,
    })
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW),
)
