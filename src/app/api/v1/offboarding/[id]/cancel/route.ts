// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/offboarding/:id/cancel
// 퇴직 처리 취소 (HR only): 직원 상태 복원 + 이력 기록
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const PUT = withPermission(
  async (_req, ctx, user: SessionUser) => {
    const { id } = await ctx.params

    const offboarding = await prisma.employeeOffboarding.findFirst({
      where: {
        id,
        employee: {
          ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}),
        },
      },
      include: { employee: { select: { id: true, companyId: true } } },
    })
    if (!offboarding) throw notFound('퇴직 처리를 찾을 수 없습니다.')
    if (offboarding.status !== 'IN_PROGRESS') {
      throw badRequest('진행 중인 퇴직 처리만 취소할 수 있습니다.')
    }

    await prisma.$transaction(async (tx) => {
      // Restore employee status to ACTIVE and clear resign date
      await tx.employee.update({
        where: { id: offboarding.employeeId },
        data: {
          status: 'ACTIVE',
          resignDate: null,
        },
      })

      // Set offboarding status to CANCELLED
      await tx.employeeOffboarding.update({
        where: { id },
        data: { status: 'CANCELLED' },
      })

      // Record history
      await tx.employeeHistory.create({
        data: {
          employeeId: offboarding.employeeId,
          changeType: 'RESIGN',
          effectiveDate: new Date(),
          reason: '퇴직 처리 취소',
          approvedBy: user.employeeId,
          toCompanyId: offboarding.employee.companyId,
        },
      })
    })

    return apiSuccess({ cancelled: true })
  },
  perm(MODULE.ONBOARDING, ACTION.APPROVE),
)
