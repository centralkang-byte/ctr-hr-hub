// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Team Attendance API (Manager View)
// GET /api/v1/attendance/team
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    // 1. Get manager's department
    const manager = await prisma.employee.findUnique({
      where: { id: user.employeeId },
      select: { departmentId: true },
    })

    if (!manager?.departmentId) {
      return apiSuccess({ date: new Date().toISOString().slice(0, 10), members: [] })
    }

    // 2. Today's date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // 3. Get all team members in the same department
    const teamMembers = await prisma.employee.findMany({
      where: {
        departmentId: manager.departmentId,
        companyId: user.companyId,
        deletedAt: null,
      },
      select: {
        id: true,
        employeeNo: true,
        name: true,
        jobGrade: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    })

    if (teamMembers.length === 0) {
      return apiSuccess({ date: today.toISOString().slice(0, 10), members: [] })
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
        position: emp.jobGrade?.name ?? '',
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
      date: today.toISOString().slice(0, 10),
      members,
    })
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW),
)
