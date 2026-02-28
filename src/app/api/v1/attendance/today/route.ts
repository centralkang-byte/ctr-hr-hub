// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/attendance/today
// 오늘의 근태 기록 조회
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── GET — 오늘의 출퇴근 기록 ────────────────────────────────

export const GET = withPermission(
  async (
    _req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    // KST(UTC+9) 기준 오늘 날짜 범위 계산
    const now = new Date()
    const kstOffset = 9 * 60 * 60 * 1000
    const kstNow = new Date(now.getTime() + kstOffset)
    const todayStart = new Date(
      Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()),
    )
    todayStart.setTime(todayStart.getTime() - kstOffset) // Convert KST midnight back to UTC

    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

    const attendance = await prisma.attendance.findFirst({
      where: {
        employeeId: user.employeeId,
        workDate: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
      orderBy: { clockIn: 'desc' },
    })

    return apiSuccess(attendance)
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW),
)
