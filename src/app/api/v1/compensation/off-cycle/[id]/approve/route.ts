// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Off-Cycle Compensation Approve
// POST /api/v1/compensation/off-cycle/[id]/approve
//
// PENDING_APPROVAL → (다음 단계 or APPROVED)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { offCycleApproveSchema } from '@/lib/schemas/compensation'
import { validateApprover } from '@/lib/approval/resolve-approval-flow'
import type { SessionUser } from '@/types'
import type { CompensationChangeType } from '@/generated/prisma/enums'

// reasonCategory → CompensationChangeType 매핑
const REASON_TO_CHANGE_TYPE: Record<string, CompensationChangeType> = {
  PROMOTION: 'PROMOTION',
  RETENTION: 'RETENTION',
  MARKET_ADJUSTMENT: 'MARKET_ADJUSTMENT',
  ROLE_CHANGE: 'ROLE_CHANGE',
  EQUITY: 'EQUITY',
  OTHER: 'OTHER',
}

export const POST = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = offCycleApproveSchema.safeParse(body)

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
        throw badRequest('승인 대기(PENDING_APPROVAL) 상태의 요청만 승인할 수 있습니다.')
      }

      // 승인 권한 검증
      const validation = await validateApprover('off_cycle_comp', request.companyId, request.employeeId, user.employeeId)

      if (!validation.allowed) {
        // 플로우 미설정 시 HR_ADMIN/SUPER_ADMIN fallback
        if (validation.noFlowConfigured) {
          if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
            throw forbidden('비정기 보상 승인 권한이 없습니다. (결재 플로우 미설정)')
          }
        } else {
          throw forbidden('비정기 보상 승인 권한이 없습니다.')
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

      const isFinalStep = request.currentStep >= request.totalSteps

      if (isFinalStep) {
        // 최종 단계: 트랜잭션으로 급여 변경 확정
        const result = await prisma.$transaction(async (tx) => {
          // Salary drift guard: 최신 급여 재확인
          const latestComp = await tx.compensationHistory.findFirst({
            where: { employeeId: request.employeeId, companyId: request.companyId },
            orderBy: { effectiveDate: 'desc' },
            select: { newBaseSalary: true },
          })

          const currentSalary = latestComp ? Number(latestComp.newBaseSalary) : 0
          const requestedCurrent = Number(request.currentBaseSalary)

          if (currentSalary !== requestedCurrent) {
            // 급여가 변경됨 → 자동 거부
            await tx.offCycleApprovalStep.update({
              where: { id: currentStepRecord.id },
              data: { status: 'REJECTED', approverId: user.employeeId, comment: '기존 연봉 정보 변경으로 자동 거부', decidedAt: now },
            })

            const rejected = await tx.offCycleCompRequest.update({
              where: { id },
              data: { status: 'REJECTED', completedAt: now },
            })

            return { rejected: true, request: rejected }
          }

          // 승인 단계 업데이트
          await tx.offCycleApprovalStep.update({
            where: { id: currentStepRecord.id },
            data: { status: 'APPROVED', approverId: user.employeeId, comment: comment ?? null, decidedAt: now },
          })

          // CompensationHistory 생성
          const changeType = REASON_TO_CHANGE_TYPE[request.reasonCategory] ?? 'OTHER'
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const effectiveDate = new Date(request.effectiveDate)
          effectiveDate.setHours(0, 0, 0, 0)
          const isFutureEffective = effectiveDate > today

          const compHistory = await tx.compensationHistory.create({
            data: {
              employeeId: request.employeeId,
              companyId: request.companyId,
              changeType,
              previousBaseSalary: request.currentBaseSalary,
              newBaseSalary: request.proposedBaseSalary,
              currency: request.currency,
              changePct: request.changePct,
              effectiveDate: request.effectiveDate,
              reason: request.reason,
              approvedById: user.employeeId,
              compaRatio: request.proposedCompaRatio,
              ...(isFutureEffective ? { isScheduled: true } : {}),
            },
          })

          // 요청 완료 처리
          const updated = await tx.offCycleCompRequest.update({
            where: { id },
            data: {
              status: 'APPROVED',
              completedAt: now,
              compensationHistoryId: compHistory.id,
            },
          })

          return { rejected: false, request: updated, compensationHistoryId: compHistory.id }
        })

        if (result.rejected) {
          throw badRequest('기존 연봉 정보가 변경되었습니다. 요청서를 갱신하세요.')
        }

        // TODO: eventBus.publish(OFF_CYCLE_COMP_APPROVED, { requestId: id })

        return apiSuccess({
          id: result.request.id,
          status: result.request.status,
          completedAt: result.request.completedAt,
          compensationHistoryId: result.compensationHistoryId,
        })
      } else {
        // 중간 단계: 현재 단계 승인 + 다음 단계로 이동
        await prisma.offCycleApprovalStep.update({
          where: { id: currentStepRecord.id },
          data: { status: 'APPROVED', approverId: user.employeeId, comment: comment ?? null, decidedAt: now },
        })

        const updated = await prisma.offCycleCompRequest.update({
          where: { id },
          data: { currentStep: request.currentStep + 1 },
        })

        return apiSuccess({
          id: updated.id,
          status: updated.status,
          currentStep: updated.currentStep,
          totalSteps: updated.totalSteps,
        })
      }
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPENSATION, ACTION.APPROVE),
)
