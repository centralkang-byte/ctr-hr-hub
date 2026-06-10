// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/attendance/clock-in
// 출근 기록
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, conflict, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { clockInSchema } from '@/lib/schemas/attendance'
import {
  resolveClockInAttribution,
  resolveEffectiveSchedule,
  scheduleInstants,
  judgeAttendanceStatus,
} from '@/lib/attendance/judgeStatus'
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

      // 법인 타임존 기준 근무일 귀속 — 자정 이후 출근한 야간 교대는 전일 귀속
      const now = new Date()
      const ctx = await resolveClockInAttribution({
        companyId: user.companyId,
        employeeId: user.employeeId,
        now,
      })

      // 1일 1레코드 정책 — 해당 근무일에 기록이 있으면 재출근 불가
      const existing = await prisma.attendance.findFirst({
        where: { employeeId: user.employeeId, workDate: ctx.workDate },
        select: { id: true, clockOut: true },
      })
      if (existing) {
        throw badRequest(
          existing.clockOut === null
            ? '이미 출근 처리된 기록이 있습니다.'
            : '오늘은 이미 출퇴근 기록이 있습니다. 수정이 필요하면 HR에 보정을 요청해 주세요.',
        )
      }

      // 지각 판정 — 교대 슬롯 우선, 없으면 법인 기준 출근시간
      const schedule = await resolveEffectiveSchedule({
        companyId: user.companyId,
        employeeId: user.employeeId,
        workDate: ctx.workDate,
        baseStartHHmm: ctx.baseStartHHmm,
        baseEndHHmm: ctx.baseEndHHmm,
      })
      const { start, end } = scheduleInstants(
        ctx.localDateStr,
        schedule.startHHmm,
        schedule.endHHmm,
        ctx.timezone,
      )
      const status = judgeAttendanceStatus({
        clockIn: now,
        clockOut: null,
        scheduledStart: start,
        scheduledEnd: end,
      })

      const prismaMethod = CLOCK_METHOD_MAP[parsed.data.method] ?? 'WEB'

      let attendance
      try {
        attendance = await prisma.attendance.create({
          data: {
            employeeId: user.employeeId,
            companyId: user.companyId,
            workDate: ctx.workDate,
            clockIn: now,
            clockInMethod: prismaMethod,
            status,
            workType: 'NORMAL',
            clockInLat: parsed.data.lat ?? null,
            clockInLng: parsed.data.lng ?? null,
            note: parsed.data.note ?? null,
          },
        })
      } catch (e) {
        // 동시 요청으로 unique(employeeId, workDate) 충돌 시 명확한 409
        if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
          throw conflict('오늘은 이미 출퇴근 기록이 있습니다.')
        }
        throw e
      }

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
