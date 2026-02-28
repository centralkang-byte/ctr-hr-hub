// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Admin Attendance Dashboard API
// GET /api/v1/attendance/admin
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)

    // 1. Determine target company
    const queryCompanyId = searchParams.get('companyId')
    const companyId =
      user.role === ROLE.SUPER_ADMIN && queryCompanyId
        ? queryCompanyId
        : user.companyId
    const companyFilter = { companyId }

    // 2. Determine target date
    const dateParam = searchParams.get('date')
    const targetDate = dateParam ? new Date(dateParam) : new Date()
    targetDate.setHours(0, 0, 0, 0)
    const nextDay = new Date(targetDate)
    nextDay.setDate(nextDay.getDate() + 1)

    const dateStr = targetDate.toISOString().slice(0, 10)

    // 3. Total employees count
    const totalEmployees = await prisma.employee.count({
      where: {
        ...companyFilter,
        deletedAt: null,
      },
    })

    // 4. Today's attendance records
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        ...companyFilter,
        workDate: { gte: targetDate, lt: nextDay },
      },
      include: {
        employee: {
          select: {
            name: true,
            employeeNo: true,
            departmentId: true,
          },
        },
      },
    })

    // 5. Calculate KPIs
    const presentCount = attendanceRecords.length
    const lateCount = attendanceRecords.filter((a) => a.status === 'LATE').length
    const absentCount = totalEmployees - presentCount
    const totalMinutesSum = attendanceRecords.reduce(
      (sum, a) => sum + (a.totalMinutes ?? 0),
      0,
    )
    const avgMinutes = presentCount > 0 ? totalMinutesSum / presentCount : 0

    // 6. Anomaly list (LATE, EARLY_OUT, ABSENT status records)
    const anomalyStatuses = ['LATE', 'EARLY_OUT', 'ABSENT'] as const
    const anomalyList = attendanceRecords
      .filter((a) => (anomalyStatuses as readonly string[]).includes(a.status))
      .map((a) => ({
        id: a.id,
        employeeId: a.employeeId,
        employeeName: a.employee.name,
        employeeNo: a.employee.employeeNo,
        status: a.status,
        clockIn: a.clockIn,
        clockOut: a.clockOut,
        workType: a.workType,
        totalMinutes: a.totalMinutes,
        note: a.note,
      }))
      .slice(0, 20)

    return apiSuccess({
      date: dateStr,
      kpi: {
        totalEmployees,
        presentCount,
        lateCount,
        absentCount,
        avgTotalMinutes: Math.round(avgMinutes),
      },
      anomalies: anomalyList,
    })
  },
  perm(MODULE.ATTENDANCE, ACTION.APPROVE),
)
