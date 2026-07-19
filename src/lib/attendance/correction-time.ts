import { fromZonedTime } from 'date-fns-tz'
import {
  formatToTz,
  isSupportedAttendanceTimezone,
} from '@/lib/timezone'

/**
 * The widest supported CTR offset transition is one hour. Scanning three hours
 * on either side leaves a deliberate safety margin while keeping the helper
 * deterministic in both the browser and the server runtime.
 */
export const ATTENDANCE_WALL_TIME_SCAN_MINUTES = 180
export const ATTENDANCE_WALL_TIME_FORMAT = "yyyy-MM-dd'T'HH:mm"

const LOCAL_WALL_TIME_RE =
  /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2})$/

export type AttendanceWallTimeResolution =
  | {
      status: 'unique'
      wallTime: string
      candidates: readonly [string]
    }
  | {
      status: 'gap'
      wallTime: string
      candidates: readonly []
    }
  | {
      status: 'fold'
      wallTime: string
      candidates: readonly [string, string, ...string[]]
    }
  | {
      status: 'invalid'
      wallTime: string
      candidates: readonly []
    }
  | {
      status: 'unsupported_timezone'
      wallTime: string
      candidates: readonly []
    }

function isValidLocalWallTime(value: string): boolean {
  const match = LOCAL_WALL_TIME_RE.exec(value)
  if (!match?.groups) return false

  const year = Number(match.groups.year)
  const month = Number(match.groups.month)
  const day = Number(match.groups.day)
  const hour = Number(match.groups.hour)
  const minute = Number(match.groups.minute)
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return false
  }

  const roundTrip = new Date(Date.UTC(year, month - 1, day, hour, minute))
  return (
    roundTrip.getUTCFullYear() === year &&
    roundTrip.getUTCMonth() === month - 1 &&
    roundTrip.getUTCDate() === day &&
    roundTrip.getUTCHours() === hour &&
    roundTrip.getUTCMinutes() === minute
  )
}

function noCandidates(
  status: 'gap' | 'invalid' | 'unsupported_timezone',
  wallTime: string,
): AttendanceWallTimeResolution {
  return Object.freeze({
    status,
    wallTime,
    candidates: Object.freeze([]),
  }) as AttendanceWallTimeResolution
}

/**
 * Resolve a company-local `datetime-local` wall value to absolute ISO candidates.
 *
 * - no candidates: the local minute is a DST gap
 * - one candidate: safe to submit
 * - two candidates: the local minute is a DST fold and requires rejection
 *
 * The returned candidates are ISO strings rather than mutable Date objects so
 * this helper can be shared safely by client and server code.
 */
export function resolveAttendanceWallTime(
  wallTime: string,
  timezone: string,
): AttendanceWallTimeResolution {
  if (!isSupportedAttendanceTimezone(timezone)) {
    return noCandidates('unsupported_timezone', wallTime)
  }
  if (!isValidLocalWallTime(wallTime)) {
    return noCandidates('invalid', wallTime)
  }

  const seed = fromZonedTime(`${wallTime}:00.000`, timezone)
  if (Number.isNaN(seed.getTime())) {
    return noCandidates('invalid', wallTime)
  }

  const candidates = new Set<number>()
  for (
    let offsetMinutes = -ATTENDANCE_WALL_TIME_SCAN_MINUTES;
    offsetMinutes <= ATTENDANCE_WALL_TIME_SCAN_MINUTES;
    offsetMinutes += 1
  ) {
    const candidateMs = seed.getTime() + offsetMinutes * 60_000
    const candidate = new Date(candidateMs)
    if (formatToTz(candidate, timezone, ATTENDANCE_WALL_TIME_FORMAT) === wallTime) {
      candidates.add(candidateMs)
    }
  }

  const isoCandidates = Object.freeze(
    [...candidates]
      .sort((left, right) => left - right)
      .map((candidateMs) => new Date(candidateMs).toISOString()),
  )

  if (isoCandidates.length === 0) {
    return noCandidates('gap', wallTime)
  }
  if (isoCandidates.length === 1) {
    return Object.freeze({
      status: 'unique',
      wallTime,
      candidates: isoCandidates as unknown as readonly [string],
    })
  }
  return Object.freeze({
    status: 'fold',
    wallTime,
    candidates: isoCandidates as unknown as readonly [string, string, ...string[]],
  })
}

/**
 * Resolve the local wall minute represented by an absolute instant. This is
 * used server-side to reject an edited explicit-offset value that falls in a
 * DST fold. The original unchanged ISO may still be retained by the caller.
 */
export function resolveAttendanceInstantWallTime(
  instant: Date | string,
  timezone: string,
): AttendanceWallTimeResolution {
  if (!isSupportedAttendanceTimezone(timezone)) {
    return noCandidates('unsupported_timezone', String(instant))
  }

  const date = typeof instant === 'string' ? new Date(instant) : instant
  if (Number.isNaN(date.getTime())) {
    return noCandidates('invalid', String(instant))
  }

  const wallTime = formatToTz(date, timezone, ATTENDANCE_WALL_TIME_FORMAT)
  return resolveAttendanceWallTime(wallTime, timezone)
}

/** Compare nullable instants by epoch, not by their textual offset spelling. */
export function sameInstant(
  left: Date | string | null,
  right: Date | string | null,
): boolean {
  if (left === null || right === null) return left === right
  const leftDate = typeof left === 'string' ? new Date(left) : left
  const rightDate = typeof right === 'string' ? new Date(right) : right
  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) return false
  return leftDate.getTime() === rightDate.getTime()
}
