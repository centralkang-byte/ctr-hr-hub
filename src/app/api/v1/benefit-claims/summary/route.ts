// src/app/api/v1/benefit-claims/summary/route.ts
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const year = Number(searchParams.get('year') ?? new Date().getFullYear())
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year + 1, 0, 1)

    const plans = await prisma.benefitPlan.findMany({
      where: {
        companyId: user.companyId,
        deletedAt: null,
        frequency: { in: ['annual', 'monthly'] },
      },
      orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }],
    })

    const claims = await prisma.benefitClaim.findMany({
      where: {
        employeeId: user.employeeId,
        createdAt: { gte: startOfYear, lt: endOfYear },
        status: { in: ['pending', 'approved', 'paid'] },
      },
      select: { benefitPlanId: true, claimAmount: true, status: true },
    })

    const usageByPlan: Record<string, { used: number; pending: number }> = {}
    for (const c of claims) {
      if (!usageByPlan[c.benefitPlanId]) usageByPlan[c.benefitPlanId] = { used: 0, pending: 0 }
      if (c.status === 'pending') usageByPlan[c.benefitPlanId].pending += c.claimAmount
      else usageByPlan[c.benefitPlanId].used += c.claimAmount
    }

    const summary = plans.map((p) => ({
      planId: p.id,
      planName: p.name,
      category: p.category,
      maxAmount: p.maxAmount,
      currency: p.currency,
      used: usageByPlan[p.id]?.used ?? 0,
      pending: usageByPlan[p.id]?.pending ?? 0,
    }))

    return apiSuccess({ year, summary })
  },
  perm(MODULE.BENEFITS, ACTION.VIEW),
)
