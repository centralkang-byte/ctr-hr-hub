// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 지각/조퇴 판정 (S276 att-09)
// 기준: 법인 AttendanceSetting.workStartTime/EndTime (기본 08:30~17:30),
//       교대근무자는 배정된 ShiftSchedule 슬롯.
// 날짜 SSOT: workDate = "법인 로컬 달력 날짜의 UTC 자정" (date-only 컨벤션).
// 순수 함수(judgeAttendanceStatus·scheduleInstants 등)는 unit 테스트 대상,
// resolve* 함수는 Prisma 의존 서버 헬퍼.
// ═══════════════════════════════════════════════════════════

import { fromZonedTime } from 'date-fns-tz'
import { prisma } from '@/lib/prisma'
import { formatToTz, parseDateOnly } from '@/lib/timezone'
import type { AttendanceStatus } from '@/generated/prisma/enums'

export const DEFAULT_WORK_START = '08:30'
export const DEFAULT_WORK_END = '17:30'
export const DEFAULT_TIMEZONE = 'Asia/Seoul'

// ─── 순수 유틸 ─────────────────────────────────────────────

/** 'HH:mm' → 분 */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** 야간 교대 여부 — 종료가 시작보다 같거나 이르면 익일 종료 */
export function isOvernight(startHHmm: string, endHHmm: string): boolean {
  return hhmmToMinutes(endHHmm) <= hhmmToMinutes(startHHmm)
}

/** 'yyyy-MM-dd' 달력 날짜 문자열에 일수 더하기 (UTC date-only 산술 — DST 무관) */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const d = parseDateOnly(dateStr)
  return new Date(d.getTime() + days * 86_400_000).toISOString().slice(0, 10)
}

/** Attendance.workDate(UTC 자정 date-only) → 'yyyy-MM-dd' */
export function workDateToDateStr(workDate: Date): string {
  return workDate.toISOString().slice(0, 10)
}

export interface ScheduleInstants {
  /** 예정 출근 시각 (절대 instant) */
  start: Date
  /** 예정 퇴근 시각 (절대 instant; 야간 교대는 익일) */
  end: Date
}

/**
 * 로컬 달력 날짜 + HH:mm + 타임존 → 절대 시각.
 * endHHmm <= startHHmm 이면 종료는 익일로 해석 (야간 교대).
 */
export function scheduleInstants(
  localDateStr: string,
  startHHmm: string,
  endHHmm: string,
  timezone: string,
): ScheduleInstants {
  const start = fromZonedTime(`${localDateStr}T${startHHmm}:00.000`, timezone)
  const endDateStr = isOvernight(startHHmm, endHHmm)
    ? addDaysToDateStr(localDateStr, 1)
    : localDateStr
  const end = fromZonedTime(`${endDateStr}T${endHHmm}:00.000`, timezone)
  return { start, end }
}

export interface JudgeInput {
  clockIn: Date | null
  clockOut: Date | null
  scheduledStart: Date
  scheduledEnd: Date
  /** 재판정 시 기존 status — 수동 ABSENT는 시각 수정만으로 해제하지 않음 (sticky) */
  previousStatus?: AttendanceStatus | null
}

/**
 * 지각/조퇴 판정 (순수).
 * - clockIn 없음 → 지각 판정 안 함 / clockOut 없음 → 조퇴 판정 안 함
 * - 경계: clockIn == start → 정상, clockOut == end → 정상 (strict 비교)
 * - 둘 다 해당하면 LATE 우선 (status 컬럼이 단일 enum이라 하나만 기록;
 *   조퇴 동시 발생은 추후 별도 컬럼 분리 시 확장)
 * - 수동 ABSENT는 sticky
 */
export function judgeAttendanceStatus(input: JudgeInput): AttendanceStatus {
  if (input.previousStatus === 'ABSENT') return 'ABSENT'
  const late = input.clockIn !== null && input.clockIn.getTime() > input.scheduledStart.getTime()
  const earlyOut =
    input.clockOut !== null && input.clockOut.getTime() < input.scheduledEnd.getTime()
  if (late) return 'LATE'
  if (earlyOut) return 'EARLY_OUT'
  return 'NORMAL'
}

// ─── 서버 리졸버 (Prisma 의존) ─────────────────────────────

export interface DayContext {
  timezone: string
  /** 법인 로컬 달력 날짜 'yyyy-MM-dd' */
  localDateStr: string
  /** 저장용 workDate = localDateStr의 UTC 자정 */
  workDate: Date
  baseStartHHmm: string
  baseEndHHmm: string
}

/**
 * 법인 기준의 "오늘" 컨텍스트 — 출퇴근 기록 조회·생성·shift 조회·판정이
 * 전부 이 한 가지 날짜 기준을 쓴다 (Codex r1-1: KST 하드코딩 제거).
 */
export async function resolveDayContext(companyId: string, at: Date): Promise<DayContext> {
  const setting = await prisma.attendanceSetting.findUnique({
    where: { companyId },
    select: { timezone: true, workStartTime: true, workEndTime: true },
  })
  const timezone = setting?.timezone ?? DEFAULT_TIMEZONE
  const localDateStr = formatToTz(at, timezone, 'yyyy-MM-dd')
  return {
    timezone,
    localDateStr,
    workDate: parseDateOnly(localDateStr),
    baseStartHHmm: setting?.workStartTime ?? DEFAULT_WORK_START,
    baseEndHHmm: setting?.workEndTime ?? DEFAULT_WORK_END,
  }
}

export interface EffectiveSchedule {
  startHHmm: string
  endHHmm: string
  source: 'shift' | 'base'
}

/**
 * 해당 근무일의 유효 스케줄 — 배정된 교대 슬롯 우선, 없으면 법인 기준 시간.
 * 계약: 반드시 "대상 attendance 행"의 companyId/employeeId 기준 (Codex r1-5 —
 * SUPER_ADMIN 보정 시 user.companyId를 쓰면 타법인 시간표로 오판정).
 */
export async function resolveEffectiveSchedule(params: {
  companyId: string
  employeeId: string
  workDate: Date
  baseStartHHmm: string
  baseEndHHmm: string
}): Promise<EffectiveSchedule> {
  const shift = await prisma.shiftSchedule.findFirst({
    where: {
      employeeId: params.employeeId,
      companyId: params.companyId,
      workDate: params.workDate,
    },
    select: { startTime: true, endTime: true },
  })
  if (shift) {
    return { startHHmm: shift.startTime, endHHmm: shift.endTime, source: 'shift' }
  }
  return { startHHmm: params.baseStartHHmm, endHHmm: params.baseEndHHmm, source: 'base' }
}

/**
 * attendance 행 기준 재판정 (보정 PUT·clock-out 공용).
 * workDate는 저장 컨벤션(UTC 자정 date-only) 그대로 받는다.
 */
export async function judgeStatusForAttendance(params: {
  companyId: string
  employeeId: string
  workDate: Date
  clockIn: Date | null
  clockOut: Date | null
  previousStatus?: AttendanceStatus | null
}): Promise<AttendanceStatus> {
  const setting = await prisma.attendanceSetting.findUnique({
    where: { companyId: params.companyId },
    select: { timezone: true, workStartTime: true, workEndTime: true },
  })
  const timezone = setting?.timezone ?? DEFAULT_TIMEZONE
  const schedule = await resolveEffectiveSchedule({
    companyId: params.companyId,
    employeeId: params.employeeId,
    workDate: params.workDate,
    baseStartHHmm: setting?.workStartTime ?? DEFAULT_WORK_START,
    baseEndHHmm: setting?.workEndTime ?? DEFAULT_WORK_END,
  })
  const { start, end } = scheduleInstants(
    workDateToDateStr(params.workDate),
    schedule.startHHmm,
    schedule.endHHmm,
    timezone,
  )
  return judgeAttendanceStatus({
    clockIn: params.clockIn,
    clockOut: params.clockOut,
    scheduledStart: start,
    scheduledEnd: end,
    previousStatus: params.previousStatus ?? null,
  })
}

/**
 * 출근 귀속 — 자정 이후 출근한 야간 근무자는 전일 교대에 귀속 (Codex r2-6).
 * 전일 슬롯이 야간(종료<=시작)이고 now가 그 종료 instant 이전이면 전일 workDate.
 */
export async function resolveClockInAttribution(params: {
  companyId: string
  employeeId: string
  now: Date
}): Promise<DayContext> {
  const ctx = await resolveDayContext(params.companyId, params.now)
  const prevDateStr = addDaysToDateStr(ctx.localDateStr, -1)
  const prevWorkDate = parseDateOnly(prevDateStr)
  const prevShift = await prisma.shiftSchedule.findFirst({
    where: {
      employeeId: params.employeeId,
      companyId: params.companyId,
      workDate: prevWorkDate,
    },
    select: { startTime: true, endTime: true },
  })
  if (prevShift && isOvernight(prevShift.startTime, prevShift.endTime)) {
    const { end } = scheduleInstants(
      prevDateStr,
      prevShift.startTime,
      prevShift.endTime,
      ctx.timezone,
    )
    if (params.now.getTime() < end.getTime()) {
      return { ...ctx, localDateStr: prevDateStr, workDate: prevWorkDate }
    }
  }
  return ctx
}

/** 퇴근 attach 가드 — 전일 미퇴근 기록은 24h 이내일 때만 붙인다 (Codex r2-6 보강) */
export const CLOCK_OUT_ATTACH_LIMIT_MS = 24 * 60 * 60 * 1000
