// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/offboarding/:id/cancel
// 퇴직 처리 취소 (HR only): 직원 상태 복원 + 태스크 일괄 취소 + 자산 정리
// E-2: Enhanced with batch task cancel + asset cleanup
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, badRequest, conflict } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { getTodayForTimezone } from '@/lib/assignments'
import {
  acquirePrimaryAssignmentEmployeeLocks,
  casPrimaryAssignment,
  getOpenPrimaryAssignment,
  getPrimaryAssignmentAtDate,
  readPrimaryAssignmentTimeline,
} from '@/lib/employee/primary-assignment-writer'
import type { SessionUser } from '@/types'

export const PUT = withPermission(
  async (_req, ctx, user: SessionUser) => {
    const { id } = await ctx.params

    // 테넌트 스코핑 = EmployeeOffboarding.companyId 직접 (소유 법인 — 전출자도 원 법인 HR이 취소 가능)
    const offboarding = await prisma.employeeOffboarding.findFirst({
      where: {
        id,
        ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}),
      },
    })
    if (!offboarding) throw notFound('퇴직 처리를 찾을 수 없습니다.')
    if (offboarding.status !== 'IN_PROGRESS') {
      throw badRequest('진행 중인 퇴직 처리만 취소할 수 있습니다.')
    }

    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM employee_offboarding
        WHERE id = ${id}
        FOR UPDATE
      `
      if (locked.length !== 1) throw notFound('퇴직 처리를 찾을 수 없습니다.')
      const freshOffboarding = await tx.employeeOffboarding.findFirst({
        where: {
          id,
          ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}),
        },
      })
      if (!freshOffboarding) throw notFound('퇴직 처리를 찾을 수 없습니다.')
      if (freshOffboarding.status !== 'IN_PROGRESS') {
        throw conflict('퇴직 처리 상태가 변경되었습니다.')
      }
      await acquirePrimaryAssignmentEmployeeLocks(tx, [freshOffboarding.employeeId])
      const timeline = await readPrimaryAssignmentTimeline(tx, freshOffboarding.employeeId)
      const openAssignment = getOpenPrimaryAssignment(timeline)
      if (!openAssignment) throw conflict('복원할 현재 주 발령을 찾을 수 없습니다.')
      const company = await tx.company.findFirst({
        where: { id: openAssignment.companyId, deletedAt: null },
        select: { timezone: true },
      })
      if (!company) throw conflict('복원할 주 발령의 법인 정보를 찾을 수 없습니다.')
      const today = getTodayForTimezone(company.timezone)
      const current = getPrimaryAssignmentAtDate(timeline, today)
      if (!current || current.id !== openAssignment.id) {
        throw conflict('예정된 미래 주 발령이 있어 퇴직 처리를 취소할 수 없습니다.')
      }
      if (!['RESIGNED', 'TERMINATED'].includes(current.status)) {
        throw conflict('퇴직 처리 이후 주 발령 상태가 변경되었습니다.')
      }

      // 1. Restore employee status to ACTIVE and clear resign date
      await tx.employee.update({
        where: { id: freshOffboarding.employeeId },
        data: { resignDate: null },
      })
      await casPrimaryAssignment(tx, current, { status: 'ACTIVE' })

      // 2. Set offboarding status to CANCELLED
      const cancelled = await tx.employeeOffboarding.updateMany({
        where: { id, status: 'IN_PROGRESS' },
        data: { status: 'CANCELLED' },
      })
      if (cancelled.count !== 1) throw conflict('퇴직 처리 상태가 변경되었습니다.')

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
          employeeId: freshOffboarding.employeeId,
          changeType: 'RESIGN',
          effectiveDate: new Date(),
          reason: '퇴직 처리 취소',
          approvedById: user.employeeId,
          toCompanyId: freshOffboarding.companyId ?? undefined,
        },
      })
    })

    return apiSuccess({ cancelled: true })
  },
  perm(MODULE.OFFBOARDING, ACTION.APPROVE),
)
