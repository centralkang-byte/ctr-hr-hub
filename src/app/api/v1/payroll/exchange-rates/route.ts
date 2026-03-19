// ═══════════════════════════════════════════════════════════
// GET  /api/v1/payroll/exchange-rates?year=X&month=Y  — 환율 조회
// PUT  /api/v1/payroll/exchange-rates                  — 환율 일괄 저장
// POST /api/v1/payroll/exchange-rates/copy-prev        — 전월 복사
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { z } from 'zod'

const querySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

const upsertSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  rates: z.array(
    z.object({
      fromCurrency: z.string().length(3),
      toCurrency: z.string().default('KRW'),
      rate: z.number().positive(),
      source: z.string().default('manual'),
    })
  ),
})

export const GET = withPermission(
  async (req: NextRequest) => {
    const url = new URL(req.url)
    const params = Object.fromEntries(url.searchParams)
    const { year, month } = querySchema.parse(params)

    const rates = await prisma.exchangeRate.findMany({
      where: { year, month, toCurrency: 'KRW' },
      orderBy: { fromCurrency: 'asc' },
    })

    return apiSuccess({ year, month, rates })
  },
  { module: MODULE.PAYROLL, action: ACTION.VIEW }
)

export const PUT = withPermission(
  async (req: NextRequest) => {
    const body = await req.json()
    const { year, month, rates } = upsertSchema.parse(body)

    const results = await Promise.all(
      rates.map((r) =>
        prisma.exchangeRate.upsert({
          where: {
            year_month_fromCurrency_toCurrency: {
              year,
              month,
              fromCurrency: r.fromCurrency,
              toCurrency: r.toCurrency ?? 'KRW',
            },
          },
          create: {
            id: crypto.randomUUID(),
            year,
            month,
            fromCurrency: r.fromCurrency,
            toCurrency: r.toCurrency ?? 'KRW',
            rate: r.rate,
            source: r.source ?? 'manual',
          },
          update: {
            rate: r.rate,
            source: r.source ?? 'manual',
          },
        })
      )
    )

    return apiSuccess({ saved: results.length, year, month })
  },
  { module: MODULE.PAYROLL, action: ACTION.UPDATE }
)
