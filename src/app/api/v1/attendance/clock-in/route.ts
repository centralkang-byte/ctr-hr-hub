// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/attendance/clock-in
// 출근 기록
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { clockInSchema } from '@/lib/schemas/attendance'
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

      // KST(UTC+9) 기준 오늘 날짜 범위
      const now = new Date()
      const kstOffset = 9 * 60 * 60 * 1000
      const kstNow = new Date(now.getTime() + kstOffset)
      const todayStart = new Date(
        Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()),
      )
      todayStart.setTime(todayStart.getTime() - kstOffset)

      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

      // 오늘 이미 출근 처리된 기록 확인 (퇴근 미완료)
      const existing = await prisma.attendance.findFirst({
        where: {
          employeeId: user.employeeId,
          workDate: { gte: todayStart, lt: todayEnd },
          clockOut: null,
        },
      })

      if (existing) {
        throw badRequest('이미 출근 처리된 기록이 있습니다.')
      }

      // workDate: KST 기준 오늘 0시 (UTC로 저장)
      const workDate = new Date(todayStart.getTime() + kstOffset)

      const prismaMethod = CLOCK_METHOD_MAP[parsed.data.method] ?? 'WEB'

      const attendance = await prisma.attendance.create({
        data: {
          employeeId: user.employeeId,
          companyId: user.companyId,
          workDate,
          clockIn: now,
          clockInMethod: prismaMethod,
          status: 'NORMAL',
          workType: 'NORMAL',
          clockInLat: parsed.data.lat ?? null,
          clockInLng: parsed.data.lng ?? null,
          note: parsed.data.note ?? null,
        },
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
