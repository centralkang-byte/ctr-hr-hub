// src/app/api/v1/benefit-plans/route.ts
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (_req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const companyId = user.companyId
    const plans = await prisma.benefitPlan.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }],
    })
    return apiSuccess(plans)
  },
  perm(MODULE.BENEFITS, ACTION.VIEW),
)
