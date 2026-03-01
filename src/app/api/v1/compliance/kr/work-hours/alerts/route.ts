// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 52-Hour Violation/Warning Alerts
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { classifyWorkHoursStatus } from '@/lib/compliance/kr'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (_req: NextRequest, _context, user: SessionUser) => {
    // Get current week
    const weekStart = new Date()
    const day = weekStart.getDay()
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1)
    weekStart.setDate(diff)
    weekStart.setHours(0, 0, 0, 0)

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const attendances = await prisma.attendance.findMany({
      where: {
        companyId: user.companyId,
        clockIn: { gte: weekStart, lt: weekEnd },
        clockOut: { not: null },
      },
      select: {
        employeeId: true,
        clockIn: true,
        clockOut: true,
      },
    })

    const hoursByEmployee = new Map<string, number>()
    for (const a of attendances) {
      if (!a.clockOut) continue
      const hours = (a.clockOut.getTime() - a.clockIn!.getTime()) / (1000 * 60 * 60)
      hoursByEmployee.set(a.employeeId, (hoursByEmployee.get(a.employeeId) ?? 0) + hours)
    }

    const alertEmployeeIds: string[] = []
    for (const [empId, hours] of hoursByEmployee) {
      const status = classifyWorkHoursStatus(hours)
      if (status !== 'COMPLIANT') alertEmployeeIds.push(empId)
    }

    const employees = alertEmployeeIds.length > 0
      ? await prisma.employee.findMany({
          where: { id: { in: alertEmployeeIds } },
          select: {
            id: true,
            name: true,
            employeeNo: true,
            department: { select: { name: true } },
          },
        })
      : []

    const alerts = employees.map((e) => {
      const hours = Math.round((hoursByEmployee.get(e.id) ?? 0) * 10) / 10
      return {
        ...e,
        weeklyHours: hours,
        status: classifyWorkHoursStatus(hours),
      }
    }).sort((a, b) => b.weeklyHours - a.weeklyHours)

    return apiSuccess(alerts)
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)
