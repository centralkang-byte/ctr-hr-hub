import { describe, expect, it } from 'vitest'
import {
  ATTENDANCE_WALL_TIME_SCAN_MINUTES,
  resolveAttendanceInstantWallTime,
  resolveAttendanceWallTime,
  sameInstant,
} from '@/lib/attendance/correction-time'
import {
  attendanceCorrectionCreateSchema,
  attendanceCorrectionDetailsV1Schema,
  buildAttendanceCorrectionDetails,
  deriveAttendanceCorrectionValues,
  isAttendanceCorrectionContextCurrent,
  isAttendanceSnapshotCurrent,
  resolveCorrectionScheduleWindow,
  validateAttendanceCorrection,
} from '@/lib/attendance/correction'
import {
  formatToTz,
  SUPPORTED_ATTENDANCE_TIMEZONES,
  type SupportedAttendanceTimezone,
} from '@/lib/timezone'

const BASE_SCHEDULE = {
  startHHmm: '08:30',
  endHHmm: '17:30',
  source: 'base' as const,
}

const OVERNIGHT_SCHEDULE = {
  startHHmm: '22:00',
  endHHmm: '06:00',
  source: 'shift' as const,
}

const SNAPSHOT = {
  clockIn: '2026-06-09T23:30:00.000Z',
  clockOut: '2026-06-10T08:30:00.000Z',
  totalMinutes: 540,
  overtimeMinutes: 0,
  status: 'NORMAL' as const,
  workType: 'NORMAL' as const,
  note: null,
}

describe('attendance correction strict schemas', () => {
  it('accepts only explicit-offset absolute instants and trims the reason', () => {
    const parsed = attendanceCorrectionCreateSchema.parse({
      clockIn: '2026-06-10T08:30:00+09:00',
      clockOut: '2026-06-10T17:30:00+09:00',
      reason: '  badge reader failed  ',
    })
    expect(parsed.reason).toBe('badge reader failed')
  })

  it('rejects offset-free timestamps and client-owned fields', () => {
    expect(
      attendanceCorrectionCreateSchema.safeParse({
        clockIn: '2026-06-10T08:30:00',
        clockOut: null,
        reason: 'reader failed',
      }).success,
    ).toBe(false)
    expect(
      attendanceCorrectionCreateSchema.safeParse({
        clockIn: '2026-06-10T08:30:00+09:00',
        clockOut: null,
        reason: 'reader failed',
        status: 'NORMAL',
      }).success,
    ).toBe(false)
  })

  it('rejects both-null, reverse, and over-24-hour ranges', () => {
    expect(
      attendanceCorrectionCreateSchema.safeParse({
        clockIn: null,
        clockOut: null,
        reason: 'reader failed',
      }).success,
    ).toBe(false)
    expect(
      attendanceCorrectionCreateSchema.safeParse({
        clockIn: '2026-06-10T10:00:00Z',
        clockOut: '2026-06-10T09:59:59Z',
        reason: 'reader failed',
      }).success,
    ).toBe(false)
    expect(
      attendanceCorrectionCreateSchema.safeParse({
        clockIn: '2026-06-10T00:00:00Z',
        clockOut: '2026-06-11T00:00:00.001Z',
        reason: 'reader failed',
      }).success,
    ).toBe(false)
  })

  it('strictly validates every V1 details level and supported timezone', () => {
    const details = buildAttendanceCorrectionDetails({
      workDate: '2026-06-10',
      timezone: 'Asia/Seoul',
      schedule: BASE_SCHEDULE,
      reason: 'reader failed',
      before: SNAPSHOT,
      requested: {
        clockIn: '2026-06-09T23:20:00.000Z',
        clockOut: SNAPSHOT.clockOut,
      },
    })
    expect(attendanceCorrectionDetailsV1Schema.safeParse(details).success).toBe(true)
    expect(
      attendanceCorrectionDetailsV1Schema.safeParse({
        ...details,
        schedule: { ...details.schedule, unexpected: true },
      }).success,
    ).toBe(false)
    expect(
      attendanceCorrectionDetailsV1Schema.safeParse({
        ...details,
        timezone: 'Pacific/Apia',
      }).success,
    ).toBe(false)
  })
})

describe('company wall-time candidate resolution', () => {
  it('resolves a normal Seoul wall minute to one absolute instant', () => {
    const result = resolveAttendanceWallTime('2026-07-17T09:30', 'Asia/Seoul')
    expect(result).toEqual({
      status: 'unique',
      wallTime: '2026-07-17T09:30',
      candidates: ['2026-07-17T00:30:00.000Z'],
    })
  })

  it('rejects Chicago and Warsaw spring gaps', () => {
    expect(resolveAttendanceWallTime('2026-03-08T02:30', 'America/Chicago').status).toBe(
      'gap',
    )
    expect(resolveAttendanceWallTime('2026-03-29T02:30', 'Europe/Warsaw').status).toBe(
      'gap',
    )
  })

  it('returns both candidates for Chicago and Warsaw fall folds', () => {
    const chicago = resolveAttendanceWallTime('2026-11-01T01:30', 'America/Chicago')
    expect(chicago.status).toBe('fold')
    expect(chicago.candidates).toEqual([
      '2026-11-01T06:30:00.000Z',
      '2026-11-01T07:30:00.000Z',
    ])

    const warsaw = resolveAttendanceWallTime('2026-10-25T02:30', 'Europe/Warsaw')
    expect(warsaw.status).toBe('fold')
    expect(warsaw.candidates).toHaveLength(2)
  })

  it('rejects invalid wall dates and valid-but-unsupported IANA zones', () => {
    expect(resolveAttendanceWallTime('2026-02-30T08:30', 'Asia/Seoul').status).toBe(
      'invalid',
    )
    expect(resolveAttendanceWallTime('2026-07-17T08:30', 'Pacific/Apia').status).toBe(
      'unsupported_timezone',
    )
  })

  it('detects an explicit-offset instant that maps into a fold', () => {
    expect(
      resolveAttendanceInstantWallTime(
        '2026-11-01T06:30:00.000Z',
        'America/Chicago',
      ).status,
    ).toBe('fold')
    expect(
      sameInstant('2026-06-10T08:30:00+09:00', '2026-06-09T23:30:00.000Z'),
    ).toBe(true)
  })

  it('keeps every supported timezone transition below the three-hour scan bound', () => {
    const fixtures: Record<SupportedAttendanceTimezone, readonly [string, string]> = {
      'Asia/Seoul': ['2026-01-15T00:00:00Z', '2026-07-15T00:00:00Z'],
      'Asia/Shanghai': ['2026-01-15T00:00:00Z', '2026-07-15T00:00:00Z'],
      'Europe/Moscow': ['2026-01-15T00:00:00Z', '2026-07-15T00:00:00Z'],
      'America/Chicago': ['2026-03-08T07:59:00Z', '2026-03-08T08:01:00Z'],
      'Asia/Ho_Chi_Minh': ['2026-01-15T00:00:00Z', '2026-07-15T00:00:00Z'],
      'Europe/Warsaw': ['2026-03-29T00:59:00Z', '2026-03-29T01:01:00Z'],
    }

    const offsetMinutes = (instant: string, timezone: string): number => {
      const offset = formatToTz(instant, timezone, 'xxx')
      if (offset === 'Z') return 0
      const sign = offset.startsWith('-') ? -1 : 1
      const [hours, minutes] = offset.slice(1).split(':').map(Number)
      return sign * (hours * 60 + minutes)
    }

    expect(Object.keys(fixtures).sort()).toEqual([...SUPPORTED_ATTENDANCE_TIMEZONES].sort())
    for (const timezone of SUPPORTED_ATTENDANCE_TIMEZONES) {
      const [before, after] = fixtures[timezone]
      const transition = Math.abs(
        offsetMinutes(after, timezone) - offsetMinutes(before, timezone),
      )
      expect(transition).toBeLessThan(ATTENDANCE_WALL_TIME_SCAN_MINUTES)
    }
  })
})

describe('schedule windows and request validation', () => {
  it('builds Seoul normal and overnight boundaries from local calendar strings', () => {
    const normal = resolveCorrectionScheduleWindow({
      workDate: '2026-06-10',
      timezone: 'Asia/Seoul',
      schedule: BASE_SCHEDULE,
    })
    expect(normal.ok).toBe(true)
    if (!normal.ok) return
    expect(normal.window.overnight).toBe(false)
    expect(normal.window.dayStart.toISOString()).toBe('2026-06-09T15:00:00.000Z')
    expect(normal.window.dayEnd.toISOString()).toBe('2026-06-10T15:00:00.000Z')

    const overnight = resolveCorrectionScheduleWindow({
      workDate: '2026-06-10',
      timezone: 'Asia/Seoul',
      schedule: OVERNIGHT_SCHEDULE,
    })
    expect(overnight.ok).toBe(true)
    if (!overnight.ok) return
    expect(overnight.window.overnight).toBe(true)
    expect(overnight.window.scheduledEnd.toISOString()).toBe('2026-06-10T21:00:00.000Z')
  })

  it('builds 23-hour and 25-hour Chicago calendar windows without fixed-ms days', () => {
    const spring = resolveCorrectionScheduleWindow({
      workDate: '2026-03-08',
      timezone: 'America/Chicago',
      schedule: BASE_SCHEDULE,
    })
    const fall = resolveCorrectionScheduleWindow({
      workDate: '2026-11-01',
      timezone: 'America/Chicago',
      schedule: BASE_SCHEDULE,
    })
    expect(spring.ok).toBe(true)
    expect(fall.ok).toBe(true)
    if (!spring.ok || !fall.ok) return
    expect(spring.window.dayEnd.getTime() - spring.window.dayStart.getTime()).toBe(
      23 * 60 * 60 * 1000,
    )
    expect(fall.window.dayEnd.getTime() - fall.window.dayStart.getTime()).toBe(
      25 * 60 * 60 * 1000,
    )
  })

  it('rejects a schedule boundary in a DST gap or fold', () => {
    const gap = resolveCorrectionScheduleWindow({
      workDate: '2026-03-08',
      timezone: 'America/Chicago',
      schedule: { startHHmm: '02:30', endHHmm: '11:30', source: 'shift' },
    })
    expect(gap).toMatchObject({ ok: false, issue: 'schedule_gap' })

    const fold = resolveCorrectionScheduleWindow({
      workDate: '2026-11-01',
      timezone: 'America/Chicago',
      schedule: { startHHmm: '01:30', endHHmm: '10:30', source: 'shift' },
    })
    expect(fold).toMatchObject({ ok: false, issue: 'schedule_fold' })
  })

  it('accepts a normal-day correction and rejects unchanged or unrelated dates', () => {
    const base = {
      before: { clockIn: SNAPSHOT.clockIn, clockOut: SNAPSHOT.clockOut },
      workDate: '2026-06-10',
      timezone: 'Asia/Seoul',
      schedule: BASE_SCHEDULE,
      now: new Date('2026-06-12T00:00:00Z'),
    }
    expect(
      validateAttendanceCorrection({
        ...base,
        requested: {
          clockIn: '2026-06-09T23:20:00.000Z',
          clockOut: SNAPSHOT.clockOut,
          reason: 'reader failed',
        },
      }).ok,
    ).toBe(true)
    expect(
      validateAttendanceCorrection({
        ...base,
        requested: {
          clockIn: SNAPSHOT.clockIn,
          clockOut: SNAPSHOT.clockOut,
          reason: 'reader failed',
        },
      }),
    ).toMatchObject({ ok: false, issue: 'unchanged' })
    expect(
      validateAttendanceCorrection({
        ...base,
        requested: {
          clockIn: '2026-06-10T15:00:00.000Z',
          clockOut: null,
          reason: 'reader failed',
        },
      }),
    ).toMatchObject({ ok: false, issue: 'clock_in_out_of_bounds' })
  })

  it('enforces overnight field-specific bounds for paired and lone values', () => {
    const base = {
      before: { clockIn: null, clockOut: null },
      workDate: '2026-06-10',
      timezone: 'Asia/Seoul',
      schedule: OVERNIGHT_SCHEDULE,
      now: new Date('2026-06-13T00:00:00Z'),
    }
    expect(
      validateAttendanceCorrection({
        ...base,
        requested: {
          clockIn: '2026-06-10T14:00:00.000Z',
          clockOut: '2026-06-11T11:00:00.000Z',
          reason: 'overnight correction',
        },
      }).ok,
    ).toBe(true)
    expect(
      validateAttendanceCorrection({
        ...base,
        requested: {
          clockIn: '2026-06-10T21:00:00.000Z',
          clockOut: null,
          reason: 'unrelated clock-in',
        },
      }),
    ).toMatchObject({ ok: false, issue: 'clock_in_out_of_bounds' })
    expect(
      validateAttendanceCorrection({
        ...base,
        requested: {
          clockIn: null,
          clockOut: '2026-06-11T14:00:00.000Z',
          reason: 'unrelated clock-out',
        },
      }),
    ).toMatchObject({ ok: false, issue: 'clock_out_out_of_bounds' })
  })

  it('rejects future values even when the other side is null', () => {
    expect(
      validateAttendanceCorrection({
        requested: {
          clockIn: '2026-06-09T23:20:00.000Z',
          clockOut: null,
          reason: 'reader failed',
        },
        before: { clockIn: null, clockOut: null },
        workDate: '2026-06-10',
        timezone: 'Asia/Seoul',
        schedule: BASE_SCHEDULE,
        now: new Date('2026-06-09T23:14:59.999Z'),
      }),
    ).toMatchObject({ ok: false, issue: 'future_time', field: 'clockIn' })
  })

  it('preserves an unchanged fold side but rejects an edited fold instant', () => {
    const common = {
      workDate: '2026-11-01',
      timezone: 'America/Chicago',
      schedule: BASE_SCHEDULE,
      now: new Date('2026-11-03T00:00:00Z'),
    }
    expect(
      validateAttendanceCorrection({
        ...common,
        before: { clockIn: '2026-11-01T06:30:00.000Z', clockOut: null },
        requested: {
          clockIn: '2026-11-01T06:30:00.000Z',
          clockOut: '2026-11-01T20:00:00.000Z',
          reason: 'add missing clock-out',
        },
      }).ok,
    ).toBe(true)

    expect(
      validateAttendanceCorrection({
        ...common,
        before: { clockIn: '2026-11-01T05:30:00.000Z', clockOut: null },
        requested: {
          clockIn: '2026-11-01T06:30:00.000Z',
          clockOut: null,
          reason: 'edited fold',
        },
      }),
    ).toMatchObject({ ok: false, issue: 'edited_fold', field: 'clockIn' })
  })
})

describe('immutable snapshots and derived fields', () => {
  it('canonicalizes and freezes the stored V1 snapshot', () => {
    const details = buildAttendanceCorrectionDetails({
      workDate: new Date('2026-06-10T00:00:00.000Z'),
      timezone: 'Asia/Seoul',
      schedule: BASE_SCHEDULE,
      reason: '  reader failed  ',
      before: {
        ...SNAPSHOT,
        clockIn: '2026-06-10T08:30:00+09:00',
      },
      requested: {
        clockIn: '2026-06-10T08:20:00+09:00',
        clockOut: SNAPSHOT.clockOut,
      },
    })
    expect(details.before.clockIn).toBe('2026-06-09T23:30:00.000Z')
    expect(details.requested.clockIn).toBe('2026-06-09T23:20:00.000Z')
    expect(details.reason).toBe('reader failed')
    expect(Object.isFrozen(details)).toBe(true)
    expect(Object.isFrozen(details.before)).toBe(true)
  })

  it('matches every immutable attendance field and effective context', () => {
    const details = buildAttendanceCorrectionDetails({
      workDate: '2026-06-10',
      timezone: 'Asia/Seoul',
      schedule: BASE_SCHEDULE,
      reason: 'reader failed',
      before: SNAPSHOT,
      requested: { clockIn: '2026-06-09T23:20:00Z', clockOut: SNAPSHOT.clockOut },
    })
    expect(
      isAttendanceSnapshotCurrent(
        { ...SNAPSHOT, workDate: new Date('2026-06-10T00:00:00Z') },
        details,
      ),
    ).toBe(true)
    expect(
      isAttendanceSnapshotCurrent(
        { ...SNAPSHOT, totalMinutes: 541, workDate: '2026-06-10' },
        details,
      ),
    ).toBe(false)
    expect(
      isAttendanceCorrectionContextCurrent(details, {
        timezone: 'Asia/Seoul',
        schedule: BASE_SCHEDULE,
      }),
    ).toBe(true)
    expect(
      isAttendanceCorrectionContextCurrent(details, {
        timezone: 'Asia/Seoul',
        schedule: { ...BASE_SCHEDULE, startHHmm: '09:00' },
      }),
    ).toBe(false)
  })

  it('derives 180 overtime minutes from a 12-hour correction', () => {
    expect(
      deriveAttendanceCorrectionValues({
        clockIn: new Date('2026-06-09T22:00:00Z'),
        clockOut: new Date('2026-06-10T10:00:00Z'),
        scheduledStart: new Date('2026-06-09T23:30:00Z'),
        scheduledEnd: new Date('2026-06-10T08:30:00Z'),
      }),
    ).toEqual({ totalMinutes: 720, overtimeMinutes: 180, status: 'NORMAL' })
  })

  it('clears derived minutes for null times and can clear a previous ABSENT', () => {
    const scheduledStart = new Date('2026-06-09T23:30:00Z')
    const scheduledEnd = new Date('2026-06-10T08:30:00Z')
    expect(
      deriveAttendanceCorrectionValues({
        clockIn: scheduledStart,
        clockOut: null,
        scheduledStart,
        scheduledEnd,
      }),
    ).toEqual({ totalMinutes: null, overtimeMinutes: null, status: 'NORMAL' })
    expect(
      deriveAttendanceCorrectionValues({
        clockIn: scheduledStart,
        clockOut: scheduledEnd,
        scheduledStart,
        scheduledEnd,
      }).status,
    ).toBe('NORMAL')
  })

  it('never clamps reverse or over-24-hour derived ranges', () => {
    const scheduledStart = new Date('2026-06-09T23:30:00Z')
    const scheduledEnd = new Date('2026-06-10T08:30:00Z')
    expect(() =>
      deriveAttendanceCorrectionValues({
        clockIn: new Date('2026-06-10T10:00:00Z'),
        clockOut: new Date('2026-06-10T09:00:00Z'),
        scheduledStart,
        scheduledEnd,
      }),
    ).toThrow(RangeError)
    expect(() =>
      deriveAttendanceCorrectionValues({
        clockIn: new Date('2026-06-10T00:00:00Z'),
        clockOut: new Date('2026-06-11T00:00:00.001Z'),
        scheduledStart,
        scheduledEnd,
      }),
    ).toThrow(RangeError)
  })
})
