// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/offboarding/[id]/tasks/[taskId]/complete
// Stage 5-B: 직원 본인 오프보딩 태스크 완료 처리
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { unauthorized, notFound, forbidden } from '@/lib/errors'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'

interface Context {
  params: Promise<{ id: string; taskId: string }>
}

export async function PUT(_req: NextRequest, context: Context) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return apiError(unauthorized())
    const user = session.user as SessionUser

    const { id: offboardingId, taskId } = await context.params

    // 1. Verify this offboarding belongs to the current user
    const offboarding = await prisma.employeeOffboarding.findFirst({
      where: { id: offboardingId, employeeId: user.employeeId, status: 'IN_PROGRESS' },
    })
    if (!offboarding) throw notFound('진행 중인 퇴직 처리를 찾을 수 없습니다.')

    // 2. Find the task instance
    const taskInstance = await prisma.employeeOffboardingTask.findFirst({
      where: { id: taskId, employeeOffboardingId: offboardingId },
      include: { task: { select: { assigneeType: true, title: true } } },
    })
    if (!taskInstance) throw notFound('해당 태스크를 찾을 수 없습니다.')

    // 3. Only EMPLOYEE tasks can be self-completed
    if (taskInstance.task.assigneeType !== 'EMPLOYEE') {
      throw forbidden('본인이 직접 완료할 수 없는 태스크입니다.')
    }

    // 4. Idempotent — already done
    if (taskInstance.status === 'DONE') {
      return apiSuccess({ message: '이미 완료된 태스크입니다.' })
    }

    // 5. Mark as done
    const updated = await prisma.employeeOffboardingTask.update({
      where: { id: taskId },
      data: {
        status:      'DONE',
        completedBy: user.employeeId,
        completedAt: new Date(),
      },
    })

    return apiSuccess({
      id:          updated.id,
      status:      updated.status,
      completedAt: updated.completedAt?.toISOString(),
    })
  } catch (error) {
    return apiError(error)
  }
}
