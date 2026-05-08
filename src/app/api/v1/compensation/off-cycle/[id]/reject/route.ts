// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Off-Cycle Compensation Reject
// POST /api/v1/compensation/off-cycle/[id]/reject
//
// PENDING_APPROVAL → REJECTED
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, conflict, notFound, forbidden, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { offCycleRejectSchema } from '@/lib/schemas/compensation'
import { validateApprover } from '@/lib/approval/resolve-approval-flow'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = offCycleRejectSchema.safeParse(body)

    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { comment } = parsed.data

    try {
      const request = await prisma.offCycleCompRequest.findFirst({
        where: { id, companyId: user.companyId },
      })

      if (!request) {
        throw notFound('비정기 보상 요청을 찾을 수 없습니다.')
      }

      if (request.status !== 'PENDING_APPROVAL') {
        throw badRequest('승인 대기(PENDING_APPROVAL) 상태의 요청만 반려할 수 있습니다.')
      }

      // 승인 권한 검증
      const validation = await validateApprover('off_cycle_comp', request.companyId, request.employeeId, user.employeeId)

      if (!validation.allowed) {
        if (validation.noFlowConfigured) {
          if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
            throw forbidden('비정기 보상 반려 권한이 없습니다. (결재 플로우 미설정)')
          }
        } else {
          throw forbidden('비정기 보상 반려 권한이 없습니다.')
        }
      }

      const now = new Date()

      // 현재 승인 단계 조회
      const currentStepRecord = await prisma.offCycleApprovalStep.findFirst({
        where: { requestId: id, stepNumber: request.currentStep, status: 'PENDING' },
      })

      if (!currentStepRecord) {
        throw badRequest('현재 승인 단계를 찾을 수 없습니다.')
      }

      // 동시 결재 race 방어: PENDING→REJECTED atomic transition (PR #19와 동일 패턴).
      // updateMany + status: 'PENDING' 조건 → READ COMMITTED row lock으로 첫 tx만
      // count=1, 둘째는 PENDING 미일치로 count=0 → race lost. mixed approve/reject
      // 동시 클릭 시 중복 처리 차단.
      const result = await prisma.$transaction(async (tx) => {
        const stepUpdate = await tx.offCycleApprovalStep.updateMany({
          where: { id: currentStepRecord.id, status: 'PENDING' },
          data: {
            status: 'REJECTED',
            approverId: user.employeeId,
            comment,
            decidedAt: now,
          },
        })
        if (stepUpdate.count === 0) return { raceLost: true } as const

        const updated = await tx.offCycleCompRequest.update({
          where: { id },
          data: {
            status: 'REJECTED',
            completedAt: now,
          },
        })

        return { raceLost: false, updated } as const
      })

      if (result.raceLost) throw conflict('이미 처리된 결재 단계입니다.')

      // TODO: eventBus.publish(OFF_CYCLE_COMP_REJECTED, { requestId: id })

      return apiSuccess({
        id: result.updated.id,
        status: result.updated.status,
        completedAt: result.updated.completedAt,
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPENSATION, ACTION.APPROVE),
)
