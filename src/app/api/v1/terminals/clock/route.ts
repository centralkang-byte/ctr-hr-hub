import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyTerminal, updateTerminalHeartbeat } from '@/lib/terminal'
import { terminalClockSchema } from '@/lib/schemas/terminal'
import { isAppError, badRequest, conflict, notFound, AppError } from '@/lib/errors'
import { apiSuccess, apiError } from '@/lib/api'
import { computeOvertimeMinutes, graduatedBreakMinutes } from '@/lib/attendance/overtime'
import {
  resolveClockInAttribution,
  resolveDayContext,
  resolveEffectiveSchedule,
  scheduleInstants,
  judgeAttendanceStatus,
  judgeStatusForAttendance,
  addDaysToDateStr,
  CLOCK_OUT_ATTACH_LIMIT_MS,
} from '@/lib/attendance/judgeStatus'
import { parseDateOnly } from '@/lib/timezone'

// ─── POST /api/v1/terminals/clock ───────────────────────
// Terminal clock event (CLOCK_IN / CLOCK_OUT)
// Uses terminal auth (X-Terminal-ID + X-Terminal-Secret), NOT withPermission

export async function POST(req: NextRequest) {
  try {
    // 1. Verify terminal
    const terminal = await verifyTerminal(req.headers)

    // 2. Parse body
    const body: unknown = await req.json()
    const parsed = terminalClockSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(badRequest('잘못된 요청'))
    }

    // 3. Find employee by employeeNo in same company
    const employee = await prisma.employee.findFirst({
      where: {
        employeeNo: parsed.data.employeeNo,
        deletedAt: null,
        assignments: {
          some: {
            companyId: terminal.companyId,
            isPrimary: true,
            endDate: null,
          },
        },
      },
    })
    if (!employee) {
      return apiError(notFound('직원을 찾을 수 없습니다.'))
    }

    // 판정·날짜 기준은 항상 단말기 이벤트 시각(eventTime) — 서버 now 사용 금지 (S276)
    const eventTime = new Date(parsed.data.timestamp)

    if (parsed.data.eventType === 'CLOCK_IN') {
      // 웹 clock-in과 동일 정책: 법인 타임존 근무일 귀속(야간 전일 귀속) + 1일 1레코드
      const ctx = await resolveClockInAttribution({
        companyId: terminal.companyId,
        employeeId: employee.id,
        now: eventTime,
      })

      const existing = await prisma.attendance.findFirst({
        where: {
          employeeId: employee.id,
          companyId: terminal.companyId,
          workDate: ctx.workDate,
        },
        select: { id: true, clockOut: true },
      })
      if (existing) {
        return apiError(
          badRequest(
            existing.clockOut === null
              ? '이미 출근 처리된 기록이 있습니다.'
              : '오늘은 이미 출퇴근 기록이 있습니다. 수정이 필요하면 HR에 보정을 요청해 주세요.',
          ),
        )
      }

      const schedule = await resolveEffectiveSchedule({
        companyId: terminal.companyId,
        employeeId: employee.id,
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
        clockIn: eventTime,
        clockOut: null,
        scheduledStart: start,
        scheduledEnd: end,
      })

      let attendance
      try {
        attendance = await prisma.attendance.create({
          data: {
            employeeId: employee.id,
            companyId: terminal.companyId,
            workDate: ctx.workDate,
            clockIn: eventTime,
            clockInMethod: 'FINGERPRINT',
            status,
            workType: 'NORMAL',
            terminalId: terminal.id,
          },
        })
      } catch (e) {
        if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
          return apiError(conflict('오늘은 이미 출퇴근 기록이 있습니다.'))
        }
        throw e
      }

      // Update heartbeat
      await updateTerminalHeartbeat(terminal.id)

      return apiSuccess({ id: attendance.id, type: 'CLOCK_IN' }, 201)
    } else {
      // CLOCK_OUT — 웹과 동일 lookback(전일까지) + 법인 스코프 + 역순/지연 이벤트 가드
      const ctx = await resolveDayContext(terminal.companyId, eventTime)
      const lookbackStart = parseDateOnly(addDaysToDateStr(ctx.localDateStr, -1))

      const existing = await prisma.attendance.findFirst({
        where: {
          employeeId: employee.id,
          companyId: terminal.companyId,
          workDate: { gte: lookbackStart },
          clockOut: null,
        },
        orderBy: [{ workDate: 'desc' }, { clockIn: 'desc' }],
      })

      if (!existing) {
        return apiError(badRequest('출근 기록이 없습니다.'))
      }

      // 0 <= eventTime − clockIn <= 24h — 역순 이벤트(음수 근무시간)·24h 초과 자동연결 거부
      const clockInTime = existing.clockIn?.getTime() ?? eventTime.getTime()
      const elapsed = eventTime.getTime() - clockInTime
      if (elapsed < 0) {
        return apiError(badRequest('퇴근 시각이 출근 시각보다 빠릅니다. 단말기 시간을 확인해 주세요.'))
      }
      if (elapsed > CLOCK_OUT_ATTACH_LIMIT_MS) {
        return apiError(
          badRequest('미처리 출근 기록이 24시간을 넘겨 자동 연결할 수 없습니다. HR에 보정을 요청해 주세요.'),
        )
      }

      const totalMinutes = Math.round(elapsed / 60000)
      // 단말기 누진 휴식(8h↑60·4h↑30) 차감 후 초과근무 — 공유 SSOT 헬퍼
      const overtimeMinutes = computeOvertimeMinutes(
        totalMinutes,
        graduatedBreakMinutes(totalMinutes),
      )

      // 조퇴 판정 — 해당 기록의 근무일·법인 기준 (LATE 유지)
      const status = await judgeStatusForAttendance({
        companyId: existing.companyId,
        employeeId: existing.employeeId,
        workDate: existing.workDate,
        clockIn: existing.clockIn,
        clockOut: eventTime,
        previousStatus: existing.status,
      })

      const attendance = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          clockOut: eventTime,
          clockOutMethod: 'FINGERPRINT',
          totalMinutes,
          overtimeMinutes,
          status,
        },
      })

      await updateTerminalHeartbeat(terminal.id)

      return apiSuccess({ id: attendance.id, type: 'CLOCK_OUT', totalMinutes, overtimeMinutes })
    }
  } catch (error) {
    if (isAppError(error)) {
      return apiError(error as AppError)
    }
    return apiError(new AppError(500, 'INTERNAL_ERROR', '서버 오류'))
  }
}
