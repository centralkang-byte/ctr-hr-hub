// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/attendance/clock-in
// 출근 기록
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { badRequest, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { clockInSchema } from '@/lib/schemas/attendance'
import { createClockInEvent } from '@/lib/attendance/clock-event-service'
import type { SessionUser } from '@/types'
import type { ClockMethod } from '@/generated/prisma/enums'

// ─── Zod method → Prisma ClockMethod 매핑 ─────────────────

const CLOCK_METHOD_MAP: Record<string, ClockMethod> = {
  WEB: 'WEB',
  MOBILE: 'MOBILE_GPS',
  TERMINAL: 'CARD_READER',
  MANUAL: 'WEB', // Manual entries recorded as WEB
}

// ─── POST — 출근 ─────────────────────────────────────────────

export const POST = withPermission(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const body: unknown = await req.json()
      const parsed = clockInSchema.safeParse(body)
      if (!parsed.success) {
        throw badRequest('입력값이 올바르지 않습니다.', {
          issues: parsed.error.issues,
        })
      }

      const now = new Date()
      const prismaMethod = CLOCK_METHOD_MAP[parsed.data.method] ?? 'WEB'
      const attendance = await createClockInEvent({
        companyId: user.companyId,
        employeeId: user.employeeId,
        eventTime: now,
        method: prismaMethod,
        source: 'web',
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        note: parsed.data.note,
      })

      // 감사 로그
      const meta = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'attendance.clock_in',
        resourceType: 'attendance',
        resourceId: attendance.id,
        companyId: user.companyId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      })

      return apiSuccess(attendance, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.CREATE),
)
