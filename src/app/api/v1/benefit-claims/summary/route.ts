// src/app/api/v1/benefit-claims/summary/route.ts
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withAuth } from '@/lib/permissions'
import type { SessionUser } from '@/types'

// 직원 self-service (/my/benefits): 본인 회사 활성 복리후생에 대한 본인(user.employeeId)
// 사용 현황 요약. withPermission(BENEFITS:VIEW)은 EMPLOYEE 403 → withAuth 로 정합.
// plans는 user.companyId, claims는 user.employeeId 로 스코프돼 테넌트/본인 격리 유지.
export const GET = withAuth(
  async (req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const year = Number(searchParams.get('year') ?? new Date().getFullYear())
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year + 1, 0, 1)

    const plans = await prisma.benefitPlan.findMany({
      where: {
        companyId: user.companyId,
        isActive: true,
        deletedAt: null,
        frequency: { in: ['annual', 'monthly'] },
      },
      orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }],
      select: { id: true, name: true, category: true, maxAmount: true, currency: true },
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
)
