// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Shift Schedule Monthly View API
// GET /api/v1/shift-schedules/[year]/[month]
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const params = await context.params
      const year = Number(params.year)
      const month = Number(params.month)

      if (
        isNaN(year) || isNaN(month) ||
        year < 2020 || year > 2100 ||
        month < 1 || month > 12
      ) {
        throw badRequest('유효하지 않은 연도 또는 월입니다.')
      }

      const { searchParams } = new URL(req.url)
      const shiftPatternId = searchParams.get('shiftPatternId') ?? undefined
      const shiftGroupId = searchParams.get('shiftGroupId') ?? undefined
      const employeeId = searchParams.get('employeeId') ?? undefined

      const companyFilter =
        user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

      // Build date range for the month
      const monthStart = startOfMonth(new Date(year, month - 1))
      const monthEnd = endOfMonth(new Date(year, month - 1))

      const days = eachDayOfInterval({ start: monthStart, end: monthEnd }).map(
        (d) => format(d, 'yyyy-MM-dd'),
      )

      const where = {
        ...companyFilter,
        workDate: {
          gte: monthStart,
          lte: monthEnd,
        },
        ...(shiftPatternId ? { shiftPatternId } : {}),
        ...(shiftGroupId ? { shiftGroupId } : {}),
        ...(employeeId ? { employeeId } : {}),
      }

      const schedules = await prisma.shiftSchedule.findMany({
        where,
        include: {
          employee: {
            select: { id: true, name: true, employeeNo: true },
          },
          shiftPattern: {
            select: { id: true, name: true, code: true },
          },
          shiftGroup: {
            select: { id: true, name: true, color: true },
          },
        },
        orderBy: [
          { employeeId: 'asc' },
          { workDate: 'asc' },
        ],
      })

      const formattedSchedules = schedules.map((s) => ({
        id: s.id,
        employeeId: s.employeeId,
        employeeName: s.employee.name,
        employeeNo: s.employee.employeeNo,
        shiftPatternId: s.shiftPatternId,
        shiftPatternName: s.shiftPattern.name,
        shiftPatternCode: s.shiftPattern.code,
        shiftGroupId: s.shiftGroupId,
        shiftGroupName: s.shiftGroup?.name ?? null,
        shiftGroupColor: s.shiftGroup?.color ?? null,
        workDate: format(s.workDate, 'yyyy-MM-dd'),
        slotIndex: s.slotIndex,
        slotName: s.slotName,
        startTime: s.startTime,
        endTime: s.endTime,
        breakMinutes: s.breakMinutes,
        isNightShift: s.isNightShift,
        status: s.status,
        note: s.note,
      }))

      return apiSuccess({
        year,
        month,
        days,
        schedules: formattedSchedules,
      })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW),
)
