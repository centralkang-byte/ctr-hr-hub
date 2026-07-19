import { describe, expect, it } from 'vitest'

import { resolvePayrollCalculationPeriod } from '@/lib/payroll/period'

describe('resolvePayrollCalculationPeriod', () => {
  it('reconstructs a legacy Seoul MONTHLY run from yearMonth', () => {
    const period = resolvePayrollCalculationPeriod({
      runType: 'MONTHLY',
      yearMonth: '2026-07',
      periodStart: new Date('2026-06-30T15:00:00.000Z'),
      periodEnd: new Date('2026-07-31T14:59:59.999Z'),
    })

    expect(period.periodStartDate.toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(period.periodEndDate.toISOString()).toBe('2026-07-31T00:00:00.000Z')
    expect(period).toMatchObject({ year: 2026, month: 7, yearMonth: '2026-07' })
  })

  it('reconstructs a legacy Chicago MONTHLY run without next-month leakage', () => {
    const period = resolvePayrollCalculationPeriod({
      runType: 'MONTHLY',
      yearMonth: '2026-07',
      periodStart: new Date('2026-07-01T05:00:00.000Z'),
      periodEnd: new Date('2026-08-01T04:59:59.999Z'),
    })

    expect(period.periodStartDate.toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(period.periodEndDate.toISOString()).toBe('2026-07-31T00:00:00.000Z')
  })

  it('preserves normalized custom dates for non-MONTHLY runs', () => {
    const period = resolvePayrollCalculationPeriod({
      runType: 'SEVERANCE',
      yearMonth: '2026-07',
      periodStart: new Date('2025-07-15T12:00:00.000Z'),
      periodEnd: new Date('2026-07-17T23:59:59.999Z'),
    })

    expect(period.periodStartDate.toISOString()).toBe('2025-07-15T00:00:00.000Z')
    expect(period.periodEndDate.toISOString()).toBe('2026-07-17T00:00:00.000Z')
    expect(period.yearMonth).toBe('2025-07')
  })

  it('rejects an invalid MONTHLY yearMonth instead of trusting timestamps', () => {
    expect(() =>
      resolvePayrollCalculationPeriod({
        runType: 'MONTHLY',
        yearMonth: '2026-13',
        periodStart: new Date('2026-07-01T00:00:00.000Z'),
        periodEnd: new Date('2026-07-31T00:00:00.000Z'),
      }),
    ).toThrow('Invalid MONTHLY payroll yearMonth')
  })
})
