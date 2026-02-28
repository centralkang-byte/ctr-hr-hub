// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/shift-roster/[year]/[month]
// 월별 근무 배정표 데이터
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
} from 'date-fns'
import type { SessionUser } from '@/types'

// ─── GET — 월별 근무 배정표 ──────────────────────────────────

export const GET = withPermission(
  async (
    _req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const { year, month } = await context.params

      const yearNum = parseInt(year, 10)
      const monthNum = parseInt(month, 10)

      if (
        isNaN(yearNum) ||
        isNaN(monthNum) ||
        yearNum < 2000 ||
        yearNum > 2100 ||
        monthNum < 1 ||
        monthNum > 12
      ) {
        throw badRequest('잘못된 연도/월 파라미터입니다.')
      }

      // 회사 필터 (SUPER_ADMIN은 전체 접근)
      const companyFilter =
        user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

      const targetDate = new Date(yearNum, monthNum - 1, 1)
      const monthStart = startOfMonth(targetDate)
      const monthEnd = endOfMonth(targetDate)

      const days = eachDayOfInterval({
        start: monthStart,
        end: monthEnd,
      }).map((d) => format(d, 'yyyy-MM-dd'))

      // 해당 월과 겹치는 배정 조회 (employee → company 필터)
      const schedules = await prisma.employeeSchedule.findMany({
        where: {
          employee: companyFilter,
          effectiveFrom: { lte: monthEnd },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: monthStart } },
          ],
        },
        include: {
          employee: {
            select: { id: true, name: true, employeeNo: true },
          },
          schedule: {
            select: { id: true, name: true, scheduleType: true },
          },
        },
        orderBy: { employee: { name: 'asc' } },
      })

      const roster = schedules.map((s) => ({
        employeeId: s.employee.id,
        employeeName: s.employee.name,
        employeeNo: s.employee.employeeNo,
        scheduleName: s.schedule.name,
        scheduleType: s.schedule.scheduleType,
        shiftGroup: s.shiftGroup,
        effectiveFrom: format(s.effectiveFrom, 'yyyy-MM-dd'),
        effectiveTo: s.effectiveTo
          ? format(s.effectiveTo, 'yyyy-MM-dd')
          : null,
      }))

      return apiSuccess({ year: yearNum, month: monthNum, days, roster })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW),
)
