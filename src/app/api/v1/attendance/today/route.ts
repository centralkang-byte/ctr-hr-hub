// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/attendance/today
// 오늘의 근태 기록 조회
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { fromZonedTime } from 'date-fns-tz'
import { resolveDayContext, addDaysToDateStr } from '@/lib/attendance/judgeStatus'
import { parseDateOnly } from '@/lib/timezone'
import type { SessionUser } from '@/types'

// ─── GET — 오늘의 출퇴근 기록 ────────────────────────────────

export const GET = withPermission(
  async (
    _req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    // 법인 타임존 기준 오늘 — 쓰기 경로(clock-in)와 동일한 workDate 컨벤션
    const now = new Date()
    const ctx = await resolveDayContext(user.companyId, now)
    const prevWorkDate = parseDateOnly(addDaysToDateStr(ctx.localDateStr, -1))
    // 법인 로컬 오늘 0시의 절대 instant — 전일 귀속 야간 기록의 "오늘 퇴근" 판별 기준
    const todayStartInstant = fromZonedTime(
      `${ctx.localDateStr}T00:00:00.000`,
      ctx.timezone,
    )

    const attendance = await prisma.attendance.findFirst({
      where: {
        employeeId: user.employeeId,
        OR: [
          { workDate: ctx.workDate },
          // 야간 교대 전일 귀속 — 진행 중이거나 오늘 자정 이후 퇴근 완료한 기록도 표시
          {
            workDate: prevWorkDate,
            OR: [{ clockOut: null }, { clockOut: { gte: todayStartInstant } }],
          },
        ],
      },
      orderBy: { workDate: 'desc' },
    })

    return apiSuccess(attendance)
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW),
)
