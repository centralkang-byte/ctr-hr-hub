import { describe, expect, it } from 'vitest'

import { assertPayrollRunPeriodMatchesYearMonth } from '@/lib/payroll/run-service'

describe('assertPayrollRunPeriodMatchesYearMonth', () => {
  it('accepts a MONTHLY run fully contained in yearMonth', () => {
    expect(() =>
      assertPayrollRunPeriodMatchesYearMonth({
        runType: 'MONTHLY',
        yearMonth: '2026-07',
        periodStart: new Date('2026-07-01T00:00:00.000Z'),
        periodEnd: new Date('2026-07-31T00:00:00.000Z'),
      }),
    ).not.toThrow()
  })

  it('rejects a MONTHLY run whose start belongs to another month', () => {
    expect(() =>
      assertPayrollRunPeriodMatchesYearMonth({
        runType: 'MONTHLY',
        yearMonth: '2026-07',
        periodStart: new Date('2026-06-30T23:59:59.000Z'),
        periodEnd: new Date('2026-07-31T00:00:00.000Z'),
      }),
    ).toThrow('계산 기간은 yearMonth 안에 있어야 합니다')
  })

  it('rejects a MONTHLY run whose end belongs to another month', () => {
    expect(() =>
      assertPayrollRunPeriodMatchesYearMonth({
        runType: 'MONTHLY',
        yearMonth: '2026-07',
        periodStart: new Date('2026-07-01T00:00:00.000Z'),
        periodEnd: new Date('2026-08-01T00:00:00.000Z'),
      }),
    ).toThrow('계산 기간은 yearMonth 안에 있어야 합니다')
  })

  it('rejects a reversed period for every run type', () => {
    expect(() =>
      assertPayrollRunPeriodMatchesYearMonth({
        runType: 'BONUS',
        yearMonth: '2026-07',
        periodStart: new Date('2026-07-31T00:00:00.000Z'),
        periodEnd: new Date('2026-07-01T00:00:00.000Z'),
      }),
    ).toThrow('급여 계산 기간이 올바르지 않습니다')
  })

  it('preserves non-MONTHLY cross-month periods', () => {
    expect(() =>
      assertPayrollRunPeriodMatchesYearMonth({
        runType: 'SEVERANCE',
        yearMonth: '2026-07',
        periodStart: new Date('2025-07-01T00:00:00.000Z'),
        periodEnd: new Date('2026-07-31T00:00:00.000Z'),
      }),
    ).not.toThrow()
  })
})
