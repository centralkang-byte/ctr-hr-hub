// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/onboarding/me
// 내 온보딩 현황 조회 (본인 최신 온보딩 1건)
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { unauthorized } from '@/lib/errors'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return apiError(unauthorized())
    const user = session.user as SessionUser

    const onboarding = await prisma.employeeOnboarding.findFirst({
      where: { employeeId: user.employeeId },
      orderBy: { createdAt: 'desc' },
      include: {
        buddy: {
          select: {
            id: true,
            name: true,
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              select: {
                jobCategory: { select: { name: true } },
              },
            },
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
  } catch (error) {
    return apiError(error)
  }
}
