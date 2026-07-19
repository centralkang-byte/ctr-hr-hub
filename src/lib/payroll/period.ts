import type { PayrollRun } from '@/generated/prisma/client'
import { normalizeUtcDateOnly } from '@/lib/timezone'

const YEAR_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/

export interface PayrollCalculationPeriodSource {
  runType: PayrollRun['runType']
  yearMonth: string
  periodStart: Date
  periodEnd: Date
}

export interface ResolvedPayrollCalculationPeriod {
  periodStartDate: Date
  periodEndDate: Date
  year: number
  month: number
  yearMonth: string
}

/**
 * MONTHLY PayrollRun.yearMonth is the period SSOT. Older browser-created runs
 * serialized local month boundaries as shifted UTC instants, so their stored
 * periodStart/periodEnd cannot safely identify the business calendar month.
 */
export function resolvePayrollCalculationPeriod(
  source: PayrollCalculationPeriodSource,
): ResolvedPayrollCalculationPeriod {
  if (source.runType === 'MONTHLY') {
    const match = YEAR_MONTH_PATTERN.exec(source.yearMonth)
    if (!match) throw new RangeError('Invalid MONTHLY payroll yearMonth')

    const year = Number(match[1])
    const month = Number(match[2])
    return {
      periodStartDate: new Date(Date.UTC(year, month - 1, 1)),
      periodEndDate: new Date(Date.UTC(year, month, 0)),
      year,
      month,
      yearMonth: source.yearMonth,
    }
  }

  const periodStartDate = normalizeUtcDateOnly(source.periodStart)
  const periodEndDate = normalizeUtcDateOnly(source.periodEnd)
  if (periodStartDate > periodEndDate) {
    throw new RangeError('Invalid payroll calculation period')
  }
  const yearMonth = periodStartDate.toISOString().slice(0, 7)
  const [year, month] = yearMonth.split('-').map(Number)
  return { periodStartDate, periodEndDate, year, month, yearMonth }
}
