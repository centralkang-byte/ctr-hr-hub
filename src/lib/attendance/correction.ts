import { z } from 'zod'
import type { AttendanceStatus, WorkType } from '@/generated/prisma/enums'
import {
  addDaysToDateStr,
  isOvernight,
  judgeAttendanceStatus,
} from '@/lib/attendance/judgeStatus'
import { computeOvertimeMinutes } from '@/lib/attendance/overtime'
import {
  resolveAttendanceInstantWallTime,
  resolveAttendanceWallTime,
  sameInstant,
} from '@/lib/attendance/correction-time'
import { isSupportedAttendanceTimezone } from '@/lib/timezone'

export const ATTENDANCE_CORRECTION_ERROR_CODES = {
  DUPLICATE: 'ATTENDANCE_CORRECTION_DUPLICATE',
  PERIOD_LOCKED: 'ATTENDANCE_PERIOD_LOCKED',
  STALE: 'ATTENDANCE_CORRECTION_STALE',
  DECISION_RACE: 'ATTENDANCE_CORRECTION_DECISION_RACE',
  CLOCK_RACE: 'ATTENDANCE_CLOCK_RACE',
  PENDING: 'ATTENDANCE_CORRECTION_PENDING',
  INVALID: 'ATTENDANCE_CORRECTION_INVALID',
  CLAIM_REQUIRED: 'ATTENDANCE_CORRECTION_CLAIM_REQUIRED',
} as const

export const ATTENDANCE_CORRECTION_MAX_DURATION_MS = 24 * 60 * 60 * 1000
export const ATTENDANCE_CORRECTION_FUTURE_TOLERANCE_MS = 5 * 60 * 1000

const HHMM_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const absoluteIsoSchema = z.string().datetime({ offset: true })
const nullableAbsoluteIsoSchema = absoluteIsoSchema.nullable()

export const attendanceCorrectionCreateSchema = z
  .object({
    clockIn: nullableAbsoluteIsoSchema,
    clockOut: nullableAbsoluteIsoSchema,
    reason: z.string().trim().min(1).max(500),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.clockIn === null && value.clockOut === null) {
      context.addIssue({
        code: 'custom',
        message: 'At least one clock value is required.',
        path: ['clockIn'],
      })
      return
    }

    if (value.clockIn !== null && value.clockOut !== null) {
      const elapsedMs = new Date(value.clockOut).getTime() - new Date(value.clockIn).getTime()
      if (elapsedMs < 0) {
        context.addIssue({
          code: 'custom',
          message: 'clockOut cannot be earlier than clockIn.',
          path: ['clockOut'],
        })
      } else if (elapsedMs > ATTENDANCE_CORRECTION_MAX_DURATION_MS) {
        context.addIssue({
          code: 'custom',
          message: 'Attendance duration cannot exceed 24 hours.',
          path: ['clockOut'],
        })
      }
    }
  })

const correctionScheduleSchema = z
  .object({
    startHHmm: z.string().regex(HHMM_RE),
    endHHmm: z.string().regex(HHMM_RE),
    source: z.enum(['shift', 'base']),
  })
  .strict()

const correctionBeforeSchema = z
  .object({
    clockIn: nullableAbsoluteIsoSchema,
    clockOut: nullableAbsoluteIsoSchema,
    totalMinutes: z.number().int().nullable(),
    overtimeMinutes: z.number().int().nullable(),
    status: z.enum(['NORMAL', 'LATE', 'EARLY_OUT', 'ABSENT']),
    workType: z.enum(['NORMAL', 'OVERTIME', 'NIGHT', 'HOLIDAY']),
    note: z.string().nullable(),
  })
  .strict()

const correctionRequestedSchema = z
  .object({
    clockIn: nullableAbsoluteIsoSchema,
    clockOut: nullableAbsoluteIsoSchema,
  })
  .strict()

export const attendanceCorrectionDetailsV1Schema = z
  .object({
    version: z.literal(1),
    workDate: z.string().date(),
    timezone: z.string().refine(isSupportedAttendanceTimezone),
    schedule: correctionScheduleSchema,
    reason: z.string().trim().min(1).max(500),
    before: correctionBeforeSchema,
    requested: correctionRequestedSchema,
  })
  .strict()

export type AttendanceCorrectionCreateInput = z.infer<
  typeof attendanceCorrectionCreateSchema
>
export type AttendanceCorrectionDetailsV1 = z.infer<
  typeof attendanceCorrectionDetailsV1Schema
>
export type AttendanceCorrectionSchedule = AttendanceCorrectionDetailsV1['schedule']
export type AttendanceCorrectionBefore = AttendanceCorrectionDetailsV1['before']

export interface AttendanceSnapshotSource {
  clockIn: Date | string | null
  clockOut: Date | string | null
  totalMinutes: number | null
  overtimeMinutes: number | null
  status: AttendanceStatus
  workType: WorkType
  note: string | null
}

export interface AttendanceSnapshotWithWorkDate extends AttendanceSnapshotSource {
  workDate: Date | string
}

function canonicalIso(value: Date | string | null): string | null {
  if (value === null) return null
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('Invalid attendance instant.')
  }
  return date.toISOString()
}

function canonicalWorkDate(value: Date | string): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new RangeError('Invalid attendance work date.')
    return value.toISOString().slice(0, 10)
  }
  const result = z.string().date().safeParse(value)
  if (!result.success) throw new RangeError('Invalid attendance work date.')
  return result.data
}

export function buildAttendanceCorrectionBefore(
  source: AttendanceSnapshotSource,
): AttendanceCorrectionBefore {
  return Object.freeze(
    correctionBeforeSchema.parse({
      clockIn: canonicalIso(source.clockIn),
      clockOut: canonicalIso(source.clockOut),
      totalMinutes: source.totalMinutes,
      overtimeMinutes: source.overtimeMinutes,
      status: source.status,
      workType: source.workType,
      note: source.note,
    }),
  )
}

export function buildAttendanceCorrectionDetails(params: {
  workDate: Date | string
  timezone: string
  schedule: AttendanceCorrectionSchedule
  reason: string
  before: AttendanceSnapshotSource
  requested: {
    clockIn: Date | string | null
    clockOut: Date | string | null
  }
}): Readonly<AttendanceCorrectionDetailsV1> {
  const parsed = attendanceCorrectionDetailsV1Schema.parse({
    version: 1,
    workDate: canonicalWorkDate(params.workDate),
    timezone: params.timezone,
    schedule: params.schedule,
    reason: params.reason,
    before: buildAttendanceCorrectionBefore(params.before),
    requested: {
      clockIn: canonicalIso(params.requested.clockIn),
      clockOut: canonicalIso(params.requested.clockOut),
    },
  })

  Object.freeze(parsed.schedule)
  Object.freeze(parsed.before)
  Object.freeze(parsed.requested)
  return Object.freeze(parsed)
}

/** Exact CAS snapshot comparison used immediately before applying a correction. */
export function isAttendanceSnapshotCurrent(
  current: AttendanceSnapshotWithWorkDate,
  details: Pick<AttendanceCorrectionDetailsV1, 'workDate' | 'before'>,
): boolean {
  let currentWorkDate: string
  let currentClockIn: string | null
  let currentClockOut: string | null
  try {
    currentWorkDate = canonicalWorkDate(current.workDate)
    currentClockIn = canonicalIso(current.clockIn)
    currentClockOut = canonicalIso(current.clockOut)
  } catch {
    return false
  }

  return (
    currentWorkDate === details.workDate &&
    currentClockIn === details.before.clockIn &&
    currentClockOut === details.before.clockOut &&
    current.totalMinutes === details.before.totalMinutes &&
    current.overtimeMinutes === details.before.overtimeMinutes &&
    current.status === details.before.status &&
    current.workType === details.before.workType &&
    current.note === details.before.note
  )
}

export function isAttendanceCorrectionContextCurrent(
  details: AttendanceCorrectionDetailsV1,
  current: { timezone: string; schedule: AttendanceCorrectionSchedule },
): boolean {
  return (
    details.timezone === current.timezone &&
    details.schedule.startHHmm === current.schedule.startHHmm &&
    details.schedule.endHHmm === current.schedule.endHHmm &&
    details.schedule.source === current.schedule.source
  )
}

export type AttendanceCorrectionValidationIssue =
  | 'invalid_body'
  | 'invalid_work_date'
  | 'unsupported_timezone'
  | 'schedule_gap'
  | 'schedule_fold'
  | 'schedule_invalid'
  | 'unchanged'
  | 'edited_fold'
  | 'edited_time_invalid'
  | 'future_time'
  | 'clock_in_out_of_bounds'
  | 'clock_out_out_of_bounds'
  | 'reverse_time'
  | 'duration_too_long'

export interface AttendanceCorrectionScheduleWindow {
  timezone: string
  workDate: string
  overnight: boolean
  dayStart: Date
  dayEnd: Date
  secondDayEnd: Date
  scheduledStart: Date
  scheduledEnd: Date
}

export type AttendanceCorrectionScheduleResult =
  | { ok: true; window: AttendanceCorrectionScheduleWindow }
  | {
      ok: false
      errorCode: typeof ATTENDANCE_CORRECTION_ERROR_CODES.INVALID
      issue: AttendanceCorrectionValidationIssue
      field?: string
    }

function validationFailure(
  issue: AttendanceCorrectionValidationIssue,
  field?: string,
): Extract<AttendanceCorrectionScheduleResult, { ok: false }> {
  return {
    ok: false,
    errorCode: ATTENDANCE_CORRECTION_ERROR_CODES.INVALID,
    issue,
    ...(field ? { field } : {}),
  }
}

function resolveWindowInstant(
  wallTime: string,
  timezone: string,
  field: string,
): Date | Extract<AttendanceCorrectionScheduleResult, { ok: false }> {
  const resolution = resolveAttendanceWallTime(wallTime, timezone)
  if (resolution.status === 'unique') return new Date(resolution.candidates[0])
  if (resolution.status === 'unsupported_timezone') {
    return validationFailure('unsupported_timezone', 'timezone')
  }
  if (resolution.status === 'gap') return validationFailure('schedule_gap', field)
  if (resolution.status === 'fold') return validationFailure('schedule_fold', field)
  return validationFailure('schedule_invalid', field)
}

export function resolveCorrectionScheduleWindow(params: {
  workDate: string
  timezone: string
  schedule: AttendanceCorrectionSchedule
}): AttendanceCorrectionScheduleResult {
  if (!z.string().date().safeParse(params.workDate).success) {
    return validationFailure('invalid_work_date', 'workDate')
  }
  if (!isSupportedAttendanceTimezone(params.timezone)) {
    return validationFailure('unsupported_timezone', 'timezone')
  }
  if (!correctionScheduleSchema.safeParse(params.schedule).success) {
    return validationFailure('schedule_invalid', 'schedule')
  }

  const nextDate = addDaysToDateStr(params.workDate, 1)
  const secondNextDate = addDaysToDateStr(params.workDate, 2)
  const overnight = isOvernight(params.schedule.startHHmm, params.schedule.endHHmm)
  const scheduledEndDate = overnight ? nextDate : params.workDate

  const candidates = {
    dayStart: resolveWindowInstant(`${params.workDate}T00:00`, params.timezone, 'dayStart'),
    dayEnd: resolveWindowInstant(`${nextDate}T00:00`, params.timezone, 'dayEnd'),
    secondDayEnd: resolveWindowInstant(
      `${secondNextDate}T00:00`,
      params.timezone,
      'secondDayEnd',
    ),
    scheduledStart: resolveWindowInstant(
      `${params.workDate}T${params.schedule.startHHmm}`,
      params.timezone,
      'schedule.startHHmm',
    ),
    scheduledEnd: resolveWindowInstant(
      `${scheduledEndDate}T${params.schedule.endHHmm}`,
      params.timezone,
      'schedule.endHHmm',
    ),
  }

  for (const candidate of Object.values(candidates)) {
    if (!(candidate instanceof Date)) return candidate
  }

  return {
    ok: true,
    window: {
      timezone: params.timezone,
      workDate: params.workDate,
      overnight,
      dayStart: candidates.dayStart as Date,
      dayEnd: candidates.dayEnd as Date,
      secondDayEnd: candidates.secondDayEnd as Date,
      scheduledStart: candidates.scheduledStart as Date,
      scheduledEnd: candidates.scheduledEnd as Date,
    },
  }
}

export type AttendanceCorrectionValidationResult =
  | {
      ok: true
      requested: AttendanceCorrectionCreateInput
      clockIn: Date | null
      clockOut: Date | null
      window: AttendanceCorrectionScheduleWindow
    }
  | Extract<AttendanceCorrectionScheduleResult, { ok: false }>

function isWithin(
  value: Date,
  lower: Date,
  upper: Date,
  upperInclusive: boolean,
): boolean {
  const timestamp = value.getTime()
  return (
    timestamp >= lower.getTime() &&
    (upperInclusive ? timestamp <= upper.getTime() : timestamp < upper.getTime())
  )
}

function editedInstantIssue(params: {
  before: Date | string | null
  requested: string | null
  timezone: string
  field: 'clockIn' | 'clockOut'
}): Extract<AttendanceCorrectionScheduleResult, { ok: false }> | null {
  if (sameInstant(params.before, params.requested) || params.requested === null) return null
  const resolution = resolveAttendanceInstantWallTime(params.requested, params.timezone)
  if (resolution.status === 'fold') return validationFailure('edited_fold', params.field)
  if (resolution.status !== 'unique') {
    return validationFailure('edited_time_invalid', params.field)
  }
  return null
}

/**
 * Validate a create/apply payload against its immutable before values and the
 * company-local schedule window. Create and final approval must both call this.
 */
export function validateAttendanceCorrection(params: {
  requested: unknown
  before: Pick<AttendanceSnapshotSource, 'clockIn' | 'clockOut'>
  workDate: string
  timezone: string
  schedule: AttendanceCorrectionSchedule
  now: Date
}): AttendanceCorrectionValidationResult {
  const parsed = attendanceCorrectionCreateSchema.safeParse(params.requested)
  if (!parsed.success) return validationFailure('invalid_body')

  const windowResult = resolveCorrectionScheduleWindow({
    workDate: params.workDate,
    timezone: params.timezone,
    schedule: params.schedule,
  })
  if (!windowResult.ok) return windowResult
  const { window } = windowResult

  if (
    sameInstant(params.before.clockIn, parsed.data.clockIn) &&
    sameInstant(params.before.clockOut, parsed.data.clockOut)
  ) {
    return validationFailure('unchanged')
  }

  const clockInEditIssue = editedInstantIssue({
    before: params.before.clockIn,
    requested: parsed.data.clockIn,
    timezone: params.timezone,
    field: 'clockIn',
  })
  if (clockInEditIssue) return clockInEditIssue
  const clockOutEditIssue = editedInstantIssue({
    before: params.before.clockOut,
    requested: parsed.data.clockOut,
    timezone: params.timezone,
    field: 'clockOut',
  })
  if (clockOutEditIssue) return clockOutEditIssue

  const clockIn = parsed.data.clockIn === null ? null : new Date(parsed.data.clockIn)
  const clockOut = parsed.data.clockOut === null ? null : new Date(parsed.data.clockOut)
  const latestAllowed = params.now.getTime() + ATTENDANCE_CORRECTION_FUTURE_TOLERANCE_MS
  if (clockIn !== null && clockIn.getTime() > latestAllowed) {
    return validationFailure('future_time', 'clockIn')
  }
  if (clockOut !== null && clockOut.getTime() > latestAllowed) {
    return validationFailure('future_time', 'clockOut')
  }

  if (clockIn !== null && clockOut !== null) {
    const elapsedMs = clockOut.getTime() - clockIn.getTime()
    if (elapsedMs < 0) return validationFailure('reverse_time', 'clockOut')
    if (elapsedMs > ATTENDANCE_CORRECTION_MAX_DURATION_MS) {
      return validationFailure('duration_too_long', 'clockOut')
    }
  }

  if (!window.overnight) {
    if (clockIn !== null && !isWithin(clockIn, window.dayStart, window.dayEnd, false)) {
      return validationFailure('clock_in_out_of_bounds', 'clockIn')
    }
    if (clockOut !== null && !isWithin(clockOut, window.dayStart, window.dayEnd, false)) {
      return validationFailure('clock_out_out_of_bounds', 'clockOut')
    }
  } else {
    if (
      clockIn !== null &&
      !isWithin(clockIn, window.dayStart, window.scheduledEnd, false)
    ) {
      return validationFailure('clock_in_out_of_bounds', 'clockIn')
    }

    if (clockOut !== null) {
      if (clockIn !== null) {
        const maxFromClockIn = new Date(
          clockIn.getTime() + ATTENDANCE_CORRECTION_MAX_DURATION_MS,
        )
        const upper =
          maxFromClockIn.getTime() <= window.secondDayEnd.getTime()
            ? maxFromClockIn
            : window.secondDayEnd
        if (!isWithin(clockOut, clockIn, upper, true)) {
          return validationFailure('clock_out_out_of_bounds', 'clockOut')
        }
      } else {
        const upper = new Date(
          window.scheduledStart.getTime() + ATTENDANCE_CORRECTION_MAX_DURATION_MS,
        )
        if (!isWithin(clockOut, window.dayStart, upper, true)) {
          return validationFailure('clock_out_out_of_bounds', 'clockOut')
        }
      }
    }
  }

  return {
    ok: true,
    requested: parsed.data,
    clockIn,
    clockOut,
    window,
  }
}

export interface DerivedAttendanceCorrectionValues {
  totalMinutes: number | null
  overtimeMinutes: number | null
  status: AttendanceStatus
}

/**
 * Recompute every time-derived column. Deliberately omits previousStatus so a
 * valid employee correction can clear an old ABSENT value.
 */
export function deriveAttendanceCorrectionValues(params: {
  clockIn: Date | null
  clockOut: Date | null
  scheduledStart: Date
  scheduledEnd: Date
}): DerivedAttendanceCorrectionValues {
  let totalMinutes: number | null = null
  let overtimeMinutes: number | null = null

  if (params.clockIn !== null && params.clockOut !== null) {
    const elapsedMs = params.clockOut.getTime() - params.clockIn.getTime()
    if (elapsedMs < 0) throw new RangeError('clockOut cannot be earlier than clockIn.')
    if (elapsedMs > ATTENDANCE_CORRECTION_MAX_DURATION_MS) {
      throw new RangeError('Attendance duration cannot exceed 24 hours.')
    }
    totalMinutes = Math.round(elapsedMs / 60_000)
    overtimeMinutes = computeOvertimeMinutes(totalMinutes)
  }

  return {
    totalMinutes,
    overtimeMinutes,
    status: judgeAttendanceStatus({
      clockIn: params.clockIn,
      clockOut: params.clockOut,
      scheduledStart: params.scheduledStart,
      scheduledEnd: params.scheduledEnd,
      previousStatus: null,
    }),
  }
}
