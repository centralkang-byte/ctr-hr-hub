// src/app/api/v1/benefit-budgets/route.ts
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { z } from 'zod'
import type { SessionUser } from '@/types'

const upsertSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  category: z.string().min(1).max(30),
  totalBudget: z.number().int().nonnegative(),
})

export const GET = withPermission(
  async (req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const year = Number(searchParams.get('year') ?? new Date().getFullYear())

    const budgets = await prisma.benefitBudget.findMany({
      where: { companyId: user.companyId, year },
      orderBy: { category: 'asc' },
    })
    return apiSuccess(budgets)
  },
  perm(MODULE.BENEFITS, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const isHR = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN
    if (!isHR) throw forbidden('HR 권한이 필요합니다.')

    const body = await req.json()
    const parsed = upsertSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)
    const { year, category, totalBudget } = parsed.data

    const budget = await prisma.benefitBudget.upsert({
      where: { companyId_year_category: { companyId: user.companyId, year, category } },
      update: { totalBudget },
      create: {
        companyId: user.companyId,
        year,
        category,
        totalBudget,
        usedAmount: 0,
      },
    })
    return apiSuccess(budget)
  },
  perm(MODULE.BENEFITS, ACTION.UPDATE),
)
