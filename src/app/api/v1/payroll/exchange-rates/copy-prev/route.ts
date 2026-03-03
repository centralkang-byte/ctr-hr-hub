// POST /api/v1/payroll/exchange-rates/copy-prev
// 전월 환율을 당월로 복사 (upsert)

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess, apiError } from '@/lib/api'
import { notFound } from '@/lib/errors'
import { z } from 'zod'

const bodySchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
})

export const POST = withPermission(
  async (req: NextRequest) => {
    const body = await req.json()
    const { year, month } = bodySchema.parse(body)

    const prevYear = month === 1 ? year - 1 : year
    const prevMonth = month === 1 ? 12 : month - 1

    const prevRates = await prisma.exchangeRate.findMany({
      where: { year: prevYear, month: prevMonth },
    })

    if (prevRates.length === 0) {
      return apiError(notFound('전월 환율 데이터가 없습니다.'))
    }

    const results = await Promise.all(
      prevRates.map((r) =>
        prisma.exchangeRate.upsert({
          where: {
            year_month_fromCurrency_toCurrency: {
              year,
              month,
              fromCurrency: r.fromCurrency,
              toCurrency: r.toCurrency,
            },
          },
          create: {
            id: crypto.randomUUID(),
            year,
            month,
            fromCurrency: r.fromCurrency,
            toCurrency: r.toCurrency,
            rate: r.rate,
            source: 'copied',
          },
          update: {
            rate: r.rate,
            source: 'copied',
          },
        })
      )
    )

    return apiSuccess({ copied: results.length, from: { year: prevYear, month: prevMonth }, to: { year, month } })
  },
  { module: MODULE.PAYROLL, action: ACTION.UPDATE }
)
