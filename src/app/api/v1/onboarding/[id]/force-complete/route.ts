// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/onboarding/:id/force-complete
// HR 강제 온보딩 완료 (미완료 태스크 SKIPPED 처리)
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const forceCompleteSchema = z.object({ reason: z.string().min(1) })

export const PUT = withPermission(
  async (req, ctx, user: SessionUser) => {
    const { id } = await ctx.params
    const body = await req.json()
    const parsed = forceCompleteSchema.safeParse(body)
    if (!parsed.success) throw badRequest('사유를 입력해주세요.')

    const onboarding = await prisma.employeeOnboarding.findUnique({
      where: { id },
      include: {
        tasks: true,
        employee: { select: { companyId: true } },
      },
    })
    if (!onboarding) throw notFound('온보딩 기록을 찾을 수 없습니다.')
    if (
      user.role !== 'SUPER_ADMIN' &&
      onboarding.employee.companyId !== user.companyId
    ) {
      throw forbidden('권한이 없습니다.')
    }

    await prisma.$transaction(async (tx) => {
      const pendingTaskIds = onboarding.tasks
        .filter((t) => t.status !== 'DONE')
        .map((t) => t.id)

      if (pendingTaskIds.length > 0) {
        await tx.employeeOnboardingTask.updateMany({
          where: { id: { in: pendingTaskIds } },
          data: {
            status: 'SKIPPED',
            completedAt: new Date(),
            note: parsed.data.reason,
          },
        })
      }

      await tx.employeeOnboarding.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })
      await tx.employee.update({
        where: { id: onboarding.employeeId },
        data: { onboardedAt: new Date() },
      })
    })

    return apiSuccess({ forceCompleted: true })
  },
  perm(MODULE.ONBOARDING, ACTION.APPROVE),
)
