// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/attendance/clock-out
// 퇴근 기록
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { badRequest, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { clockOutSchema } from '@/lib/schemas/attendance'
import type { SessionUser } from '@/types'
import type { ClockMethod } from '@/generated/prisma/enums'
import { checkWorkHourAlert } from '@/lib/attendance/workHourAlert'
import { completeClockOutEvent } from '@/lib/attendance/clock-event-service'

// ─── Zod method → Prisma ClockMethod 매핑 ─────────────────

const CLOCK_METHOD_MAP: Record<string, ClockMethod> = {
  WEB: 'WEB',
  MOBILE: 'MOBILE_GPS',
  TERMINAL: 'CARD_READER',
  MANUAL: 'WEB',
}

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

      const now = new Date()
      const prismaMethod = CLOCK_METHOD_MAP[parsed.data.method] ?? 'WEB'
      const { attendance, totalMinutes, overtimeMinutes } =
        await completeClockOutEvent({
          companyId: user.companyId,
          employeeId: user.employeeId,
          eventTime: now,
          method: prismaMethod,
          source: 'web',
          overtimeBreakPolicy: 'default',
          note: parsed.data.note,
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

      // 52시간 경고 체크 (비동기, 실패해도 clock-out 응답에 영향 없음)
      const alertResult = await checkWorkHourAlert(
        user.employeeId,
        user.companyId,
      ).catch(() => null)

      return apiSuccess({
        ...attendance,
        weeklyHours: alertResult?.weeklyHours ?? null,
        alertLevel: alertResult?.alertLevel ?? null,
        isBlocked: alertResult?.isBlocked ?? false,
      })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.CREATE),
)
