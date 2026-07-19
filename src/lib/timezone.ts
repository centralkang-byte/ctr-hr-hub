/**
 * timezone.ts — Global Timezone Utility (SSOT)
 *
 * All timezone-aware date operations must use these helpers.
 * Supported timezones per company:
 *   CTR (+ CTR-HOLD, CTR-MOB, CTR-ECO, CTR-ROB, CTR-ENR, CTR-FML) → Asia/Seoul
 *   CTR-CN  → Asia/Shanghai
 *   CTR-RU  → Europe/Moscow
 *   CTR-US  → America/Chicago
 *   CTR-VN  → Asia/Ho_Chi_Minh
 *   CTR-EU  → Europe/Warsaw
 */

import { parseISO } from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

export const SUPPORTED_ATTENDANCE_TIMEZONES = [
  'Asia/Seoul',
  'Asia/Shanghai',
  'Europe/Moscow',
  'America/Chicago',
  'Asia/Ho_Chi_Minh',
  'Europe/Warsaw',
] as const

export type SupportedAttendanceTimezone =
  (typeof SUPPORTED_ATTENDANCE_TIMEZONES)[number]

export function isSupportedAttendanceTimezone(
  timezone: string,
): timezone is SupportedAttendanceTimezone {
  return (SUPPORTED_ATTENDANCE_TIMEZONES as readonly string[]).includes(timezone)
}

/**
 * Formats a date into a string according to the given timezone.
 *
 * @param date         Date object, ISO string, or null
 * @param timezone     IANA timezone string (e.g. 'Asia/Seoul')
 * @param formatString date-fns format string (e.g. 'yyyy-MM-dd HH:mm')
 * @returns            Formatted string, or '' if date is null
 */
export function formatToTz(
  date: Date | string | null,
  timezone: string,
  formatString: string
): string {
  if (!date) return ''
  const d = typeof date === 'string' ? parseISO(date) : date
  return formatInTimeZone(d, timezone, formatString)
}

/**
 * Returns a UTC Date representing 00:00:00.000 of the given date
 * in the specified timezone.
 *
 * @param date     Date object or ISO string
 * @param timezone IANA timezone string (e.g. 'Asia/Seoul')
 */
export function getStartOfDayTz(date: Date | string, timezone: string): Date {
  const d = typeof date === 'string' ? parseISO(date) : date
  const localDateStr = formatInTimeZone(d, timezone, 'yyyy-MM-dd')
  return fromZonedTime(`${localDateStr}T00:00:00.000`, timezone)
}

/**
 * Returns a UTC Date representing 23:59:59.999 of the given date
 * in the specified timezone.
 *
 * @param date     Date object or ISO string
 * @param timezone IANA timezone string (e.g. 'Asia/Seoul')
 */
export function getEndOfDayTz(date: Date | string, timezone: string): Date {
  const d = typeof date === 'string' ? parseISO(date) : date
  const localDateStr = formatInTimeZone(d, timezone, 'yyyy-MM-dd')
  return fromZonedTime(`${localDateStr}T23:59:59.999`, timezone)
}

function formatUtcDateOnly(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('Invalid date-only value')
  }

  return date.toISOString().slice(0, 10)
}

/**
 * Normalizes a serialized date-only DB value to UTC midnight without applying
 * a timezone offset. The UTC calendar date is the business value.
 */
export function normalizeUtcDateOnly(date: Date): Date {
  return parseDateOnly(formatUtcDateOnly(date))
}

/**
 * Parses a 'YYYY-MM-DD' calendar date string into a Date at 00:00:00 UTC,
 * ignoring the runtime's local timezone.
 * Use this for calendar-only values like birthDate, hireDate, etc.
 *
 * @param dateString e.g. '1990-07-15'
 */
export function parseDateOnly(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}
