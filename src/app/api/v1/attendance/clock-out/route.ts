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
import { checkWorkHourAlert } from '@/lib/attendance/workHourAlert'
import { computeOvertimeMinutes } from '@/lib/attendance/overtime'
import {
  resolveDayContext,
  judgeStatusForAttendance,
  addDaysToDateStr,
  CLOCK_OUT_ATTACH_LIMIT_MS,
} from '@/lib/attendance/judgeStatus'
import { parseDateOnly } from '@/lib/timezone'

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

      // 법인 타임존 기준 lookback — 야간 교대는 익일 아침 퇴근하므로
      // 오늘만 보지 않고 전일까지 미완료 기록을 찾는다
      const now = new Date()
      const ctx = await resolveDayContext(user.companyId, now)
      const lookbackStart = parseDateOnly(addDaysToDateStr(ctx.localDateStr, -1))

      const existing = await prisma.attendance.findFirst({
        where: {
          employeeId: user.employeeId,
          workDate: { gte: lookbackStart },
          clockOut: null,
        },
        orderBy: [{ workDate: 'desc' }, { clockIn: 'desc' }],
      })

      if (!existing) {
        throw badRequest('출근 기록이 없습니다.')
      }

      // attach 가드 — 전일 출근이 24h를 넘겼으면 자동 연결하지 않음 (HR 보정 대상).
      // 어제 퇴근 누락 기록이 오늘 저녁 퇴근을 삼키는 것 방지
      const clockInTime = existing.clockIn?.getTime() ?? now.getTime()
      if (now.getTime() - clockInTime > CLOCK_OUT_ATTACH_LIMIT_MS) {
        throw badRequest(
          '미처리 출근 기록이 24시간을 넘겨 자동 연결할 수 없습니다. HR에 보정을 요청해 주세요.',
        )
      }

      // 총 근무 시간 계산 (분)
      const totalMinutes = Math.round((now.getTime() - clockInTime) / 60000)

      // 초과근무 시간 (분) — 공유 SSOT 헬퍼 (기본 휴식 60분 차감)
      const overtimeMinutes = computeOvertimeMinutes(totalMinutes)

      // 조퇴 판정 — 해당 기록의 근무일·법인 기준 (LATE는 유지, NORMAL만 EARLY_OUT으로)
      const status = await judgeStatusForAttendance({
        companyId: existing.companyId,
        employeeId: existing.employeeId,
        workDate: existing.workDate,
        clockIn: existing.clockIn,
        clockOut: now,
        previousStatus: existing.status,
      })

      const prismaMethod = CLOCK_METHOD_MAP[parsed.data.method] ?? 'WEB'

      const attendance = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          clockOut: now,
          clockOutMethod: prismaMethod,
          totalMinutes: Math.round(totalMinutes),
          overtimeMinutes: Math.round(overtimeMinutes),
          status,
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
