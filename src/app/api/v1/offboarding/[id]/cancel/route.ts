// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/offboarding/:id/cancel
// 퇴직 처리 취소 (HR only): 직원 상태 복원 + 태스크 일괄 취소 + 자산 정리
// E-2: Enhanced with batch task cancel + asset cleanup
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

export const PUT = withPermission(
  async (_req, ctx, user: SessionUser) => {
    const { id } = await ctx.params

    const offboarding = await prisma.employeeOffboarding.findFirst({
      where: {
        id,
        ...(user.role !== 'SUPER_ADMIN'
          ? { employee: { assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } } } }
          : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              select: { companyId: true },
            },
          },
        },
      },
    })
    if (!offboarding) throw notFound('퇴직 처리를 찾을 수 없습니다.')
    if (offboarding.status !== 'IN_PROGRESS') {
      throw badRequest('진행 중인 퇴직 처리만 취소할 수 있습니다.')
    }

    await prisma.$transaction(async (tx) => {
      // 1. Restore employee status to ACTIVE and clear resign date
      await tx.employee.update({
        where: { id: offboarding.employeeId },
        data: { resignDate: null },
      })
      await tx.employeeAssignment.updateMany({
        where: { employeeId: offboarding.employeeId, isPrimary: true, endDate: null },
        data: { status: 'ACTIVE' },
      })

      // 2. Set offboarding status to CANCELLED
      await tx.employeeOffboarding.update({
        where: { id },
        data: { status: 'CANCELLED' },
      })

      // 3. E-2: Batch-cancel ALL non-DONE tasks → set SKIPPED
      await tx.employeeOffboardingTask.updateMany({
        where: {
          employeeOffboardingId: id,
          status: { in: ['PENDING', 'IN_PROGRESS', 'BLOCKED'] },
        },
        data: { status: 'SKIPPED' },
      })

      // 4. E-2: Cancel any pending asset returns → set to RETURNED (no deduction needed)
      await tx.assetReturn.updateMany({
        where: {
          offboardingId: id,
          status: { in: ['PENDING', 'UNRETURNED'] },
        },
        data: { status: 'RETURNED' },
      })

      // 5. Record history
      await tx.employeeHistory.create({
        data: {
          employeeId: offboarding.employeeId,
          changeType: 'RESIGN',
          effectiveDate: new Date(),
          reason: '퇴직 처리 취소',
          approvedById: user.employeeId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          toCompanyId: (extractPrimaryAssignment(offboarding.employee.assignments ?? []) as any)?.companyId ?? undefined,
        },
      })
    })

    return apiSuccess({ cancelled: true })
  },
  perm(MODULE.OFFBOARDING, ACTION.APPROVE),
)
