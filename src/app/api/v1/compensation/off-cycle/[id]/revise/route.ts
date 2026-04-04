// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Off-Cycle Compensation Revise
// POST /api/v1/compensation/off-cycle/[id]/revise
//
// REJECTED → DRAFT (재기안)
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

      if (request.status !== 'REJECTED') {
        throw badRequest('반려(REJECTED) 상태의 요청만 재기안할 수 있습니다.')
      }

      if (request.initiatorId !== user.employeeId) {
        throw forbidden('요청을 발의한 사람만 재기안할 수 있습니다.')
      }

      // 트랜잭션: 기존 승인 단계 삭제 + 상태 초기화
      const result = await prisma.$transaction(async (tx) => {
        // 기존 승인 단계 삭제
        await tx.offCycleApprovalStep.deleteMany({
          where: { requestId: id },
        })

        // 상태 초기화
        const updated = await tx.offCycleCompRequest.update({
          where: { id },
          data: {
            status: 'DRAFT',
            currentStep: 0,
            totalSteps: 0,
            completedAt: null,
            submittedAt: null,
          },
        })

        return updated
      })

      return apiSuccess({
        id: result.id,
        status: result.status,
        currentStep: result.currentStep,
        totalSteps: result.totalSteps,
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPENSATION, ACTION.UPDATE),
)
