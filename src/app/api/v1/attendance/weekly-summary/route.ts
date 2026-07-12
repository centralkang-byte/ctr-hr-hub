// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/attendance/weekly-summary
// 이번 주 근태 요약 (본인)
// 주 경계는 법인 타임존 SSOT(resolveDayContext) 기준 — KST 하드코딩 금지
// (런칭 감사 P1: 해외 법인 주간 창 오프셋 버그, S335).
// workDate 계약 = parseDateOnly(법인-로컬 날짜) = "로컬 날짜의 UTC 자정"
// → 주 산술은 순수 UTC 로만 수행 (date-fns startOfWeek 는 서버 로컬 tz 의존이라 금지).
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { parseDateOnly } from '@/lib/timezone'
import { resolveDayContext, workDateToDateStr } from '@/lib/attendance/judgeStatus'
import type { SessionUser } from '@/types'

const DAY_MS = 24 * 60 * 60 * 1000

// ─── GET — 이번 주 근태 요약 ─────────────────────────────────

export const GET = withPermission(
  async (
    _req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    // 법인 타임존 기준 "오늘" → UTC 자정 표현
    const ctx = await resolveDayContext(user.companyId, new Date())
    const todayUTC = parseDateOnly(ctx.localDateStr)

    // 이번 주 월요일~일요일 (순수 UTC 산술 — 서버 tz 무관)
    const dowFromMonday = (todayUTC.getUTCDay() + 6) % 7 // 0=월
    const weekStart = new Date(todayUTC.getTime() - dowFromMonday * DAY_MS)
    const weekEnd = new Date(weekStart.getTime() + 6 * DAY_MS)
    const queryEnd = new Date(weekStart.getTime() + 7 * DAY_MS)

    const records = await prisma.attendance.findMany({
      where: {
        employeeId: user.employeeId,
        workDate: {
          gte: weekStart,
          lt: queryEnd,
        },
      },
      orderBy: { workDate: 'asc' },
    })

    // 일별 데이터 매핑 — workDate(UTC 자정)의 날짜 문자열로 매칭
    const recordByDateStr = new Map(records.map((r) => [workDateToDateStr(r.workDate), r]))
    const days = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(weekStart.getTime() + i * DAY_MS)
      const dateStr = workDateToDateStr(day)
      const record = recordByDateStr.get(dateStr)

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
      weekStart: workDateToDateStr(weekStart),
      weekEnd: workDateToDateStr(weekEnd),
      days,
      totalMinutes,
      totalOvertimeMinutes,
    }

    return apiSuccess(summary)
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW),
)
