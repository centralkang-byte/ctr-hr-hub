// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Off-Cycle Compensation Cancel
// POST /api/v1/compensation/off-cycle/[id]/cancel
//
// DRAFT | PENDING_APPROVAL → CANCELLED
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    try {
      const request = await prisma.offCycleCompRequest.findFirst({
        where: { id, companyId: user.companyId },
      })

      if (!request) {
        throw notFound('비정기 보상 요청을 찾을 수 없습니다.')
      }

      if (!['DRAFT', 'PENDING_APPROVAL'].includes(request.status)) {
        throw badRequest('초안(DRAFT) 또는 승인 대기(PENDING_APPROVAL) 상태의 요청만 취소할 수 있습니다.')
      }

      // 발의자 본인 또는 HR_ADMIN/SUPER_ADMIN만 취소 가능
      const isInitiator = request.initiatorId === user.employeeId
      const isAdmin = ['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)

      if (!isInitiator && !isAdmin) {
        throw forbidden('요청을 발의한 사람 또는 HR 관리자만 취소할 수 있습니다.')
      }

      const now = new Date()

      const updated = await prisma.offCycleCompRequest.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          completedAt: now,
        },
      })

      return apiSuccess({
        id: updated.id,
        status: updated.status,
        completedAt: updated.completedAt,
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPENSATION, ACTION.UPDATE),
)
