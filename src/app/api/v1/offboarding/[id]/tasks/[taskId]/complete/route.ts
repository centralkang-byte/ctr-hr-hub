// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/offboarding/:id/tasks/:taskId/complete
// 퇴직 태스크 완료 처리 (필수 태스크 모두 완료 시 퇴직 처리 종료)
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const PUT = withPermission(
  async (_req, ctx, user: SessionUser) => {
    const { id, taskId } = await ctx.params

    // Verify the offboarding exists and is in progress
    const offboarding = await prisma.employeeOffboarding.findFirst({
      where: {
        id,
        employee: {
          ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}),
        },
      },
      include: {
        offboardingTasks: { include: { task: true } },
      },
    })
    if (!offboarding) throw notFound('퇴직 처리를 찾을 수 없습니다.')
    if (offboarding.status !== 'IN_PROGRESS') {
      throw badRequest('진행 중인 퇴직 처리만 태스크를 완료할 수 있습니다.')
    }

    // Verify the task belongs to this offboarding
    const targetTask = offboarding.offboardingTasks.find((t) => t.id === taskId)
    if (!targetTask) throw notFound('태스크를 찾을 수 없습니다.')
    if (targetTask.status === 'DONE') {
      throw badRequest('이미 완료된 태스크입니다.')
    }

    await prisma.$transaction(async (tx) => {
      // Mark task as DONE
      await tx.employeeOffboardingTask.update({
        where: { id: taskId },
        data: {
          status: 'DONE',
          completedAt: new Date(),
          completedBy: user.employeeId,
        },
      })

      // Check if all required tasks are now done (including current one)
      const updatedTasks = offboarding.offboardingTasks.map((t) =>
        t.id === taskId ? { ...t, status: 'DONE' as const } : t,
      )
      const allRequiredDone = updatedTasks
        .filter((t) => t.task.isRequired)
        .every((t) => t.status === 'DONE')

      if (allRequiredDone) {
        await tx.employeeOffboarding.update({
          where: { id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        })
        // NOTE: IT account deactivation will be added in Task 12
      }
    })

    return apiSuccess({ completed: true })
  },
  perm(MODULE.ONBOARDING, ACTION.UPDATE),
)
