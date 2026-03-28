/**
 * 통합 휴가 일수 계산 엔진
 *
 * LeaveTypeDef.countingMethod + includesHolidays 조합에 따라 동작:
 *
 * | countingMethod | includesHolidays | 동작                            |
 * |----------------|------------------|---------------------------------|
 * | business_day   | false (기본)      | 주말 제외 + 공휴일 제외           |
 * | business_day   | true             | 주말 제외, 공휴일 포함            |
 * | calendar_day   | true             | 모든 날 포함 (경조사/출산 통산)    |
 * | calendar_day   | false            | 주말 포함, 공휴일 제외            |
 */

export type CountingMethod = 'business_day' | 'calendar_day'

export interface LeaveDayCountOptions {
  startDate: Date
  endDate: Date
  countingMethod: CountingMethod
  includesHolidays: boolean
  /** 해당 법인의 공휴일 목록 (countingMethod에 따라 제외/포함 판단) */
  holidays?: Date[]
}

/**
 * 시작일~종료일 사이의 휴가 일수를 산정한다 (양 끝 포함).
 */
export function calculateLeaveDays({
  startDate,
  endDate,
  countingMethod,
  includesHolidays,
  holidays = [],
}: LeaveDayCountOptions): number {
  if (startDate > endDate) return 0

  // calendar_day + includesHolidays: 단순 날짜 차이 (통산 — 경조사, 출산휴가)
  if (countingMethod === 'calendar_day' && includesHolidays) {
    const msPerDay = 86_400_000
    return Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay) + 1
  }

  const holidaySet = new Set(
    holidays.map((h) => h.toISOString().split('T')[0])
  )

  let count = 0
  const current = new Date(startDate)

  while (current <= endDate) {
    const day = current.getDay()
    const dateStr = current.toISOString().split('T')[0]
    const isWeekend = day === 0 || day === 6
    const isHoliday = holidaySet.has(dateStr)

    if (countingMethod === 'business_day') {
      // 주말 제외, 공휴일은 includesHolidays에 따라
      if (!isWeekend && (includesHolidays || !isHoliday)) {
        count++
      }
    } else {
      // calendar_day + includesHolidays=false: 주말 포함, 공휴일 제외
      if (!isHoliday) {
        count++
      }
    }

    current.setDate(current.getDate() + 1)
  }

  return count
}
