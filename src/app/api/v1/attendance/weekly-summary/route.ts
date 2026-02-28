// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/attendance/weekly-summary
// 이번 주 근태 요약
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
} from 'date-fns'
import type { SessionUser } from '@/types'

// ─── GET — 이번 주 근태 요약 ─────────────────────────────────

export const GET = withPermission(
  async (
    _req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    // KST(UTC+9) 기준 현재 시각
    const now = new Date()
    const kstOffset = 9 * 60 * 60 * 1000
    const kstNow = new Date(now.getTime() + kstOffset)

    // KST 기준 이번 주 월요일~일요일
    const weekStart = startOfWeek(kstNow, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(kstNow, { weekStartsOn: 1 })

    // UTC로 변환하여 DB 쿼리
    const queryStart = new Date(weekStart.getTime() - kstOffset)
    const queryEnd = new Date(weekEnd.getTime() - kstOffset + 24 * 60 * 60 * 1000)

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
    const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd })
    const days = daysInWeek.map((day) => {
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
      }
    })

    // 주간 합계
    const totalMinutes = days.reduce((sum, d) => sum + d.totalMinutes, 0)
    const totalOvertimeMinutes = days.reduce((sum, d) => sum + d.overtimeMinutes, 0)

    const summary = {
      weekStart: format(weekStart, 'yyyy-MM-dd'),
      weekEnd: format(weekEnd, 'yyyy-MM-dd'),
      days,
      totalMinutes,
      totalOvertimeMinutes,
    }

    return apiSuccess(summary)
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW),
)
