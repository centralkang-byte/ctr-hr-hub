/**
 * 법인별 공휴일 조회 헬퍼
 *
 * Holiday 모델에서 해당 법인, 해당 기간의 공휴일을 조회한다.
 */

import { prisma } from '@/lib/prisma'

/**
 * companyId + 기간으로 공휴일 Date 배열을 반환한다.
 */
export async function fetchCompanyHolidays(
  companyId: string,
  startDate: Date,
  endDate: Date,
): Promise<Date[]> {
  const holidays = await prisma.holiday.findMany({
    where: {
      companyId,
      date: { gte: startDate, lte: endDate },
    },
    select: { date: true },
  })

  return holidays.map((h) => h.date)
}
