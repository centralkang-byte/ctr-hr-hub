// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/attendance/clock-out
// 퇴근 기록
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { clockOutSchema } from '@/lib/schemas/attendance'
import type { SessionUser } from '@/types'
import type { ClockMethod } from '@/generated/prisma/enums'

// ─── Zod method → Prisma ClockMethod 매핑 ─────────────────

const CLOCK_METHOD_MAP: Record<string, ClockMethod> = {
  WEB: 'WEB',
  MOBILE: 'MOBILE_GPS',
  TERMINAL: 'CARD_READER',
  MANUAL: 'WEB',
}

// ─── 기본 근무 설정 (분 단위) ─────────────────────────────────

const STANDARD_MINUTES = 480 // 8시간
const BREAK_MINUTES = 60    // 1시간 휴식

// ─── POST — 퇴근 ─────────────────────────────────────────────

export const POST = withPermission(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const body: unknown = await req.json()
      const parsed = clockOutSchema.safeParse(body)
      if (!parsed.success) {
        throw badRequest('입력값이 올바르지 않습니다.', {
          issues: parsed.error.issues,
        })
      }

      // KST(UTC+9) 기준 오늘 날짜 범위
      const now = new Date()
      const kstOffset = 9 * 60 * 60 * 1000
      const kstNow = new Date(now.getTime() + kstOffset)
      const todayStart = new Date(
        Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()),
      )
      todayStart.setTime(todayStart.getTime() - kstOffset)

      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

      // 오늘의 미완료 출근 기록 조회
      const existing = await prisma.attendance.findFirst({
        where: {
          employeeId: user.employeeId,
          workDate: { gte: todayStart, lt: todayEnd },
          clockOut: null,
        },
        orderBy: { clockIn: 'desc' },
      })

      if (!existing) {
        throw badRequest('출근 기록이 없습니다.')
      }

      // 총 근무 시간 계산 (분)
      const clockInTime = existing.clockIn?.getTime() ?? now.getTime()
      const totalMinutes = Math.round((now.getTime() - clockInTime) / 60000)

      // 초과근무 시간: (총 근무 - 휴식 - 표준근무) 이 양수이면 초과근무
      const overtimeMinutes = Math.max(0, totalMinutes - BREAK_MINUTES - STANDARD_MINUTES)

      const prismaMethod = CLOCK_METHOD_MAP[parsed.data.method] ?? 'WEB'

      const attendance = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          clockOut: now,
          clockOutMethod: prismaMethod,
          totalMinutes: Math.round(totalMinutes),
          overtimeMinutes: Math.round(overtimeMinutes),
          note: parsed.data.note ?? existing.note,
        },
      })

      // 감사 로그
      const meta = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'attendance.clock_out',
        resourceType: 'attendance',
        resourceId: attendance.id,
        companyId: user.companyId,
        changes: {
          totalMinutes,
          overtimeMinutes,
        },
        ip: meta.ip,
        userAgent: meta.userAgent,
      })

      return apiSuccess(attendance)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.CREATE),
)
