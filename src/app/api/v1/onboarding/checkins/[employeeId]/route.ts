// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/onboarding/checkins/:employeeId
// 특정 직원의 체크인 이력 조회
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess } from '@/lib/api'
import type { SessionUser } from '@/types'

const MODULE = { ONBOARDING: 'onboarding' }
const ACTION = { VIEW: 'read' }

export const GET = withPermission(
  async (_req: NextRequest, ctx: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { employeeId } = await ctx.params
    const checkins = await prisma.onboardingCheckin.findMany({
      where: { employeeId, ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}) },
      orderBy: { checkinWeek: 'asc' },
    })
    return apiSuccess(checkins)
  },
  perm(MODULE.ONBOARDING, ACTION.VIEW),
)
