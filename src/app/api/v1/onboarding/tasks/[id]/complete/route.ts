// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/onboarding/tasks/:id/complete
// 온보딩 태스크 완료 처리 (필수 태스크 모두 완료 시 온보딩 종료)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { notFound, unauthorized } from '@/lib/errors'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { eventBus, DOMAIN_EVENTS } from '@/lib/events'
import type { SessionUser } from '@/types'

export async function PUT(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return apiError(unauthorized())
    const user = session.user as SessionUser
    const { id } = await ctx.params

    const task = await prisma.employeeOnboardingTask.findUnique({
      where: { id },
      include: {
        employeeOnboarding: {
          include: { tasks: { include: { task: true } } },
        },
        task: { select: { category: true } },   // category 추가 (이벤트 payload용)
      },
    })
    if (!task) throw notFound('태스크를 찾을 수 없습니다.')

    const onboarding  = task.employeeOnboarding
    const companyId   = onboarding.companyId ?? ''

    await prisma.$transaction(async (tx) => {
      await tx.employeeOnboardingTask.update({
        where: { id },
        data: {
          status:      'DONE',
          completedAt: new Date(),
          completedBy: user.employeeId,
        },
      })

      // Check if all required tasks are now done (including current one)
      const updatedTasks = onboarding.tasks.map((t) =>
        t.id === id ? { ...t, status: 'DONE' as const } : t,
      )
      const allRequiredDone = updatedTasks
        .filter((t) => t.task.isRequired)
        .every((t) => t.status === 'DONE')

      if (allRequiredDone && onboarding.status !== 'COMPLETED') {
        await tx.employeeOnboarding.update({
          where: { id: task.employeeOnboardingId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        })
        await tx.employee.update({
          where: { id: onboarding.employeeId },
          data: { onboardedAt: new Date() },
        })

        // ONBOARDING_COMPLETED — TX 내부 발행
        await eventBus.publish(
          DOMAIN_EVENTS.ONBOARDING_COMPLETED,
          {
            ctx: { companyId, actorId: user.employeeId, occurredAt: new Date() },
            employeeOnboardingId: task.employeeOnboardingId,
            employeeId:           onboarding.employeeId,
            companyId,
            completedAt:          new Date(),
          },
          tx,
        )
      }

      // ONBOARDING_TASK_COMPLETED — TX 내부 발행
      await eventBus.publish(
        DOMAIN_EVENTS.ONBOARDING_TASK_COMPLETED,
        {
          ctx: { companyId, actorId: user.employeeId, occurredAt: new Date() },
          employeeOnboardingTaskId: id,
          employeeOnboardingId:     task.employeeOnboardingId,
          employeeId:               onboarding.employeeId,
          companyId,
          completedBy:              user.employeeId,
          taskCategory:             task.task?.category ?? 'OTHER',
          allRequiredDone:          updatedTasks
            .filter((t) => t.task.isRequired)
            .every((t) => t.status === 'DONE'),
        },
        tx,
      )
    })

    return apiSuccess({ completed: true })
  } catch (error) {
    return apiError(error)
  }
}
