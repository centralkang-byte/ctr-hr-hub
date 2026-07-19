import { describe, expect, it } from 'vitest'

import {
  acquireExclusivePeriodLock,
  acquireSharedPeriodLock,
  attendancePeriodLockKey,
  isAttendancePeriodEditable,
  validateYearMonth,
  yearMonthFromWorkDate,
} from '@/lib/attendance/period-lock'

describe('attendance period editability', () => {
  it('allows a month with no MONTHLY payroll run', () => {
    expect(isAttendancePeriodEditable(null)).toBe(true)
  })

  it('does not let a BONUS run lock attendance', () => {
    expect(
      isAttendancePeriodEditable({
        id: 'bonus',
        runType: 'BONUS',
        status: 'PAID',
        attendanceClosedAt: new Date(),
      }),
    ).toBe(true)
  })

  it('allows only an unclosed DRAFT MONTHLY run', () => {
    expect(
      isAttendancePeriodEditable({
        id: 'draft',
        runType: 'MONTHLY',
        status: 'DRAFT',
        attendanceClosedAt: null,
      }),
    ).toBe(true)
    expect(
      isAttendancePeriodEditable({
        id: 'inconsistent-draft',
        runType: 'MONTHLY',
        status: 'DRAFT',
        attendanceClosedAt: new Date('2026-07-31T00:00:00.000Z'),
      }),
    ).toBe(false)
  })

  it.each([
    'ATTENDANCE_CLOSED',
    'CALCULATING',
    'ADJUSTMENT',
    'REVIEW',
    'PENDING_APPROVAL',
    'APPROVED',
    'PAID',
    'CANCELLED',
  ] as const)('locks MONTHLY attendance in %s', (status) => {
    expect(
      isAttendancePeriodEditable({
        id: status,
        runType: 'MONTHLY',
        status,
        attendanceClosedAt: null,
      }),
    ).toBe(false)
  })
})

describe('attendance period keys', () => {
  it('uses the UTC date-only month at a boundary', () => {
    expect(yearMonthFromWorkDate(new Date('2026-07-01T00:00:00.000Z'))).toBe('2026-07')
    expect(yearMonthFromWorkDate(new Date('2026-06-30T23:59:59.999Z'))).toBe('2026-06')
  })

  it('rejects malformed months before constructing a lock key', () => {
    expect(() => validateYearMonth('2026-00')).toThrow('YYYY-MM')
    expect(() => validateYearMonth('2026-13')).toThrow('YYYY-MM')
    expect(attendancePeriodLockKey('company-a', '2026-07')).toBe(
      'attendance-period:company-a:2026-07',
    )
  })

  it('executes advisory lock functions without deserializing their void result', async () => {
    const statements: string[] = []
    const tx = {
      // Prisma 7 interactive transaction proxies still expose this method.
      $transaction: async () => undefined,
      $executeRaw: async (parts: TemplateStringsArray) => {
        statements.push(parts.join('?'))
        return 1
      },
    }

    await acquireSharedPeriodLock(tx as never, {
      companyId: 'company-a',
      yearMonth: '2026-07',
      operation: 'shared-test',
    })
    await acquireExclusivePeriodLock(tx as never, {
      companyId: 'company-a',
      yearMonth: '2026-07',
      operation: 'exclusive-test',
    })

    expect(statements).toEqual([
      expect.stringContaining('pg_advisory_xact_lock_shared'),
      expect.stringContaining('pg_advisory_xact_lock('),
    ])
  })

  it('rejects a root client that has connection lifecycle methods', async () => {
    const rootClient = {
      $connect: async () => undefined,
      $executeRaw: async () => 1,
    }

    await expect(
      acquireSharedPeriodLock(rootClient as never, {
        companyId: 'company-a',
        yearMonth: '2026-07',
        operation: 'root-client-test',
      }),
    ).rejects.toMatchObject({ code: 'ATTENDANCE_TRANSACTION_REQUIRED' })
  })
})
