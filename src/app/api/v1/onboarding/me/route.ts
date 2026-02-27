// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/onboarding/me
// 내 온보딩 현황 조회 (본인 최신 온보딩 1건)
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess } from '@/lib/api'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (_req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const onboarding = await prisma.employeeOnboarding.findFirst({
      where: { employeeId: user.employeeId },
      orderBy: { createdAt: 'desc' },
      include: {
        buddy: {
          select: {
            id: true,
            name: true,
            jobCategory: { select: { name: true } },
          },
        },
        template: { select: { id: true, name: true } },
        tasks: {
          include: {
            task: {
              select: {
                id: true,
                title: true,
                description: true,
                assigneeType: true,
                dueDaysAfter: true,
                isRequired: true,
                category: true,
                sortOrder: true,
              },
            },
          },
          orderBy: { task: { sortOrder: 'asc' } },
        },
      },
    })

    return apiSuccess(onboarding)
  },
  perm(MODULE.ONBOARDING, ACTION.VIEW),
)
