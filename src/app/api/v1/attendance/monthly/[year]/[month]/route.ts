// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/attendance/monthly/[year]/[month]
// 월별 근태 캘린더 데이터
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

// ─── GET — 월별 근태 데이터 ──────────────────────────────────

export const GET = withPermission(
  async (
    _req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const { year, month } = await context.params

      // 파라미터 유효성 검증
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
        throw badRequest('유효하지 않은 년/월 값입니다.')
      }

      const kstOffset = 9 * 60 * 60 * 1000

      // 해당 월의 시작과 끝 (KST 기준)
      const targetMonth = new Date(yearNum, monthNum - 1, 1) // KST local date
      const monthStart = startOfMonth(targetMonth)
      const monthEnd = endOfMonth(targetMonth)

      // UTC로 변환하여 DB 쿼리
      const queryStart = new Date(monthStart.getTime() - kstOffset)
      const queryEnd = new Date(monthEnd.getTime() - kstOffset + 24 * 60 * 60 * 1000)

      const records = await prisma.attendance.findMany({
        where: {
          employeeId: user.employeeId,
          workDate: {
            gte: queryStart,
            lt: queryEnd,
          },
        },
        orderBy: { workDate: 'asc' },
      })

      // 일별 데이터 매핑
      const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
      const days = daysInMonth.map((day) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const record = records.find(
          (r) => format(new Date(r.workDate.getTime() + kstOffset), 'yyyy-MM-dd') === dateStr,
        )

        return {
          date: dateStr,
          status: record?.status ?? null,
          clockIn: record?.clockIn?.toISOString() ?? null,
          clockOut: record?.clockOut?.toISOString() ?? null,
          totalMinutes: record?.totalMinutes ?? 0,
          overtimeMinutes: record?.overtimeMinutes ?? 0,
          workType: record?.workType ?? null,
          note: record?.note ?? null,
        }
      })

      // 월간 합계
      const totalMinutes = days.reduce((sum, d) => sum + d.totalMinutes, 0)
      const totalOvertimeMinutes = days.reduce((sum, d) => sum + d.overtimeMinutes, 0)
      const workedDays = days.filter((d) => d.status !== null).length

      const result = {
        year: yearNum,
        month: monthNum,
        days,
        summary: {
          workedDays,
          totalMinutes,
          totalOvertimeMinutes,
        },
      }

      return apiSuccess(result)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW),
)
