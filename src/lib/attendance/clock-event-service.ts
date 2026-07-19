// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Guarded Attendance Clock Events
// Lock order: period advisory lock -> attendance row lock.
// ═══════════════════════════════════════════════════════════

import 'server-only'

import type { ClockMethod } from '@/generated/prisma/enums'
import { prisma } from '@/lib/prisma'
import { AppError, badRequest, conflict } from '@/lib/errors'
import {
  addDaysToDateStr,
  CLOCK_OUT_ATTACH_LIMIT_MS,
  isOvernight,
  judgeAttendanceStatus,
  judgeStatusForAttendance,
  resolveDayContext,
  resolveEffectiveSchedule,
  scheduleInstants,
  type DayContext,
} from '@/lib/attendance/judgeStatus'
import {
  computeOvertimeMinutes,
  graduatedBreakMinutes,
} from '@/lib/attendance/overtime'
import {
  acquireSharedPeriodLock,
  assertAttendancePeriodEditable,
  lockAttendanceForUpdate,
  yearMonthFromWorkDate,
  type PeriodLockHooks,
} from '@/lib/attendance/period-lock'
import type { AttendanceDb } from '@/lib/attendance/timezone-resolver'
import { parseDateOnly } from '@/lib/timezone'

type ClockEventSource = 'web' | 'terminal'
type OvertimeBreakPolicy = 'default' | 'graduated'
const CLOCK_EVENT_TRANSACTION_TIMEOUT_MS = 60_000

export interface ClockEventServiceDeps extends PeriodLockHooks {
  db?: typeof prisma
  afterCandidateRead?: (context: {
    operation: string
    attendanceId?: string
  }) => Promise<void>
}

interface CreateClockInParams {
  companyId: string
  employeeId: string
  eventTime: Date
  method: ClockMethod
  source: ClockEventSource
  lat?: number | null
  lng?: number | null
  note?: string | null
  terminalId?: string | null
  deps?: ClockEventServiceDeps
}

interface CompleteClockOutParams {
  companyId: string
  employeeId: string
  eventTime: Date
  method: ClockMethod
  source: ClockEventSource
  overtimeBreakPolicy: OvertimeBreakPolicy
  note?: string
  deps?: ClockEventServiceDeps
}

function clockRace(): AppError {
  return new AppError(
    409,
    'ATTENDANCE_CLOCK_RACE',
    '다른 출퇴근 처리로 기록이 이미 변경되었습니다. 최신 근태를 확인해 주세요.',
  )
}

async function resolveClockInAttributionWithDb(params: {
  db: AttendanceDb
  companyId: string
  employeeId: string
  eventTime: Date
}): Promise<DayContext> {
  const ctx = await resolveDayContext(
    params.companyId,
    params.eventTime,
    params.db,
  )
  const previousDateStr = addDaysToDateStr(ctx.localDateStr, -1)
  const previousWorkDate = parseDateOnly(previousDateStr)
  const previousShift = await params.db.shiftSchedule.findFirst({
    where: {
      employeeId: params.employeeId,
      companyId: params.companyId,
      workDate: previousWorkDate,
    },
    select: { startTime: true, endTime: true },
  })

  if (
    previousShift &&
    isOvernight(previousShift.startTime, previousShift.endTime)
  ) {
    const { end } = scheduleInstants(
      previousDateStr,
      previousShift.startTime,
      previousShift.endTime,
      ctx.timezone,
    )
    if (params.eventTime.getTime() < end.getTime()) {
      return {
        ...ctx,
        localDateStr: previousDateStr,
        workDate: previousWorkDate,
      }
    }
  }

  return ctx
}

export async function createClockInEvent(params: CreateClockInParams) {
  const db = params.deps?.db ?? prisma
  const candidateContext = await resolveClockInAttributionWithDb({
    db,
    companyId: params.companyId,
    employeeId: params.employeeId,
    eventTime: params.eventTime,
  })
  const operation = `${params.source}-clock-in`
  await params.deps?.afterCandidateRead?.({ operation })

  return db.$transaction(async (tx) => {
    const yearMonth = yearMonthFromWorkDate(candidateContext.workDate)
    await acquireSharedPeriodLock(tx, {
      companyId: params.companyId,
      yearMonth,
      operation,
      deps: params.deps,
    })
    await assertAttendancePeriodEditable(tx, {
      companyId: params.companyId,
      yearMonth,
    })

    const existing = await tx.attendance.findFirst({
      where: {
        employeeId: params.employeeId,
        companyId: params.companyId,
        workDate: candidateContext.workDate,
      },
      select: { id: true, clockOut: true },
    })
    if (existing) {
      throw badRequest(
        existing.clockOut === null
          ? '이미 출근 처리된 기록이 있습니다.'
          : '오늘은 이미 출퇴근 기록이 있습니다. 수정이 필요하면 HR에 보정을 요청해 주세요.',
      )
    }

    // Settings and shift reads use the same transaction client as the write.
    const eventDayContext = await resolveDayContext(
      params.companyId,
      params.eventTime,
      tx,
    )
    const schedule = await resolveEffectiveSchedule(
      {
        companyId: params.companyId,
        employeeId: params.employeeId,
        workDate: candidateContext.workDate,
        baseStartHHmm: eventDayContext.baseStartHHmm,
        baseEndHHmm: eventDayContext.baseEndHHmm,
      },
      tx,
    )
    const { start, end } = scheduleInstants(
      candidateContext.localDateStr,
      schedule.startHHmm,
      schedule.endHHmm,
      eventDayContext.timezone,
    )
    const status = judgeAttendanceStatus({
      clockIn: params.eventTime,
      clockOut: null,
      scheduledStart: start,
      scheduledEnd: end,
    })

    try {
      return await tx.attendance.create({
        data: {
          employeeId: params.employeeId,
          companyId: params.companyId,
          workDate: candidateContext.workDate,
          clockIn: params.eventTime,
          clockInMethod: params.method,
          status,
          workType: 'NORMAL',
          clockInLat: params.lat ?? null,
          clockInLng: params.lng ?? null,
          note: params.note ?? null,
          terminalId: params.terminalId ?? null,
        },
      })
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw conflict('오늘은 이미 출퇴근 기록이 있습니다.')
      }
      throw error
    }
  }, { timeout: CLOCK_EVENT_TRANSACTION_TIMEOUT_MS })
}

export async function completeClockOutEvent(params: CompleteClockOutParams) {
  const db = params.deps?.db ?? prisma
  const dayContext = await resolveDayContext(
    params.companyId,
    params.eventTime,
    db,
  )
  const lookbackStart = parseDateOnly(
    addDaysToDateStr(dayContext.localDateStr, -1),
  )
  const operation = `${params.source}-clock-out`

  const candidate = await db.attendance.findFirst({
    where: {
      employeeId: params.employeeId,
      companyId: params.companyId,
      // The upper bound prevents a future-dated correction/device event from
      // consuming this clock-out, while still allowing overnight shifts.
      workDate: { gte: lookbackStart, lte: dayContext.workDate },
      clockOut: null,
    },
    orderBy: [{ workDate: 'desc' }, { clockIn: 'desc' }],
  })
  if (!candidate) {
    throw badRequest('출근 기록이 없습니다.')
  }
  await params.deps?.afterCandidateRead?.({
    operation,
    attendanceId: candidate.id,
  })

  const yearMonth = yearMonthFromWorkDate(candidate.workDate)
  return db.$transaction(async (tx) => {
    await acquireSharedPeriodLock(tx, {
      companyId: params.companyId,
      yearMonth,
      operation,
      deps: params.deps,
    })
    const attendance = await lockAttendanceForUpdate(tx, {
      companyId: params.companyId,
      attendanceId: candidate.id,
      operation,
      deps: params.deps,
    })
    if (
      !attendance ||
      attendance.employeeId !== params.employeeId ||
      attendance.workDate.getTime() < lookbackStart.getTime() ||
      attendance.workDate.getTime() > dayContext.workDate.getTime() ||
      attendance.clockOut !== null
    ) {
      throw clockRace()
    }

    await assertAttendancePeriodEditable(tx, {
      companyId: attendance.companyId,
      yearMonth,
    })

    const clockInTime =
      attendance.clockIn?.getTime() ?? params.eventTime.getTime()
    const elapsed = params.eventTime.getTime() - clockInTime
    if (elapsed < 0) {
      throw badRequest(
        params.source === 'terminal'
          ? '퇴근 시각이 출근 시각보다 빠릅니다. 단말기 시간을 확인해 주세요.'
          : '출근 시각이 현재 시각 이후인 기록입니다. HR에 보정을 요청해 주세요.',
      )
    }
    if (elapsed > CLOCK_OUT_ATTACH_LIMIT_MS) {
      throw badRequest(
        '미처리 출근 기록이 24시간을 넘겨 자동 연결할 수 없습니다. HR에 보정을 요청해 주세요.',
      )
    }

    const totalMinutes = Math.round(elapsed / 60_000)
    const overtimeMinutes = computeOvertimeMinutes(
      totalMinutes,
      params.overtimeBreakPolicy === 'graduated'
        ? graduatedBreakMinutes(totalMinutes)
        : undefined,
    )
    const status = await judgeStatusForAttendance(
      {
        companyId: attendance.companyId,
        employeeId: attendance.employeeId,
        workDate: attendance.workDate,
        clockIn: attendance.clockIn,
        clockOut: params.eventTime,
        previousStatus: attendance.status,
      },
      tx,
    )

    const updated = await tx.attendance.update({
      where: { id: attendance.id },
      data: {
        clockOut: params.eventTime,
        clockOutMethod: params.method,
        totalMinutes,
        overtimeMinutes,
        status,
        ...(params.note !== undefined ? { note: params.note } : {}),
      },
    })

    return { attendance: updated, totalMinutes, overtimeMinutes }
  }, { timeout: CLOCK_EVENT_TRANSACTION_TIMEOUT_MS })
}
