// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/employees/:id/offboarding
// 직원 상세 페이지용 퇴직 처리 정보 조회
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (_req: NextRequest, ctx, user: SessionUser) => {
    const { id: employeeId } = await ctx.params

    const offboarding = await prisma.employeeOffboarding.findFirst({
      where: {
        employeeId,
        employee: {
          ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}),
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        checklist: { select: { id: true, name: true } },
        offboardingTasks: {
          include: {
            task: {
              select: {
                id: true,
                title: true,
                description: true,
                assigneeType: true,
                dueDaysBefore: true,
                isRequired: true,
                sortOrder: true,
              },
            },
          },
          orderBy: { task: { sortOrder: 'asc' } },
        },
        handoverTo: { select: { id: true, name: true } },
      },
    })

    if (!offboarding) throw notFound('퇴직 처리 정보를 찾을 수 없습니다.')

    return apiSuccess(offboarding)
  },
  perm(MODULE.ONBOARDING, ACTION.VIEW),
)
