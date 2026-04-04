// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Off-Cycle Compensation Submit
// POST /api/v1/compensation/off-cycle/[id]/submit
//
// DRAFT → PENDING_APPROVAL (또는 자동 승인 시 APPROVED)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { resolveApprovalFlow, resolveApproverByRole } from '@/lib/approval/resolve-approval-flow'
import type { SessionUser } from '@/types'
import type { ApproverRole } from '@/types/settings'
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
  async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    try {
      const request = await prisma.offCycleCompRequest.findFirst({
        where: { id, companyId: user.companyId },
      })

      if (!request) {
        throw notFound('비정기 보상 요청을 찾을 수 없습니다.')
      }

      if (request.status !== 'DRAFT') {
        throw badRequest('초안(DRAFT) 상태의 요청만 제출할 수 있습니다.')
      }

      if (request.initiatorId !== user.employeeId) {
        throw forbidden('요청을 발의한 사람만 제출할 수 있습니다.')
      }

      // 승인 플로우 조회
      const resolvedSteps = await resolveApprovalFlow('off_cycle_comp', request.companyId)

      // 플로우 미설정 시 기본 단계: hr_admin
      const stepsToCreate = resolvedSteps.length > 0
        ? resolvedSteps
        : [{ stepOrder: 1, approverRole: 'hr_admin' as ApproverRole, approverUserId: null, approverType: 'role', isRequired: true, autoApproveDays: null }]

      // 각 단계별 승인자 해석 + 자동 승인(self-skip) 처리
      const now = new Date()
      const stepData: Array<{
        stepNumber: number
        roleRequired: string
        approverId: string | null
        status: 'PENDING' | 'APPROVED'
        comment: string | null
        decidedAt: Date | null
      }> = []

      for (const step of stepsToCreate) {
        let resolverId: string | null = null

        if (step.approverType === 'specific_user' && step.approverUserId) {
          resolverId = step.approverUserId
        } else if (step.approverRole) {
          resolverId = await resolveApproverByRole(
            step.approverRole,
            request.employeeId,
            request.companyId,
          )
        }

        // Self-approval skip: 발의자와 승인자가 동일하면 자동 승인
        const isSelfApproval = resolverId !== null && resolverId === request.initiatorId
        stepData.push({
          stepNumber: step.stepOrder,
          roleRequired: step.approverRole ?? step.approverType,
          approverId: isSelfApproval ? resolverId : null,
          status: isSelfApproval ? 'APPROVED' : 'PENDING',
          comment: isSelfApproval ? 'System auto-approved (self-skip)' : null,
          decidedAt: isSelfApproval ? now : null,
        })
      }

      // 첫 번째 미승인 단계 찾기
      const firstPendingIdx = stepData.findIndex((s) => s.status === 'PENDING')
      const allAutoApproved = firstPendingIdx === -1

      const result = await prisma.$transaction(async (tx) => {
        // 승인 단계 생성
        await tx.offCycleApprovalStep.createMany({
          data: stepData.map((s) => ({
            requestId: id,
            stepNumber: s.stepNumber,
            roleRequired: s.roleRequired,
            approverId: s.approverId,
            status: s.status,
            comment: s.comment,
            decidedAt: s.decidedAt,
          })),
        })

        if (allAutoApproved) {
          // 모든 단계 자동 승인 → 바로 APPROVED + CompensationHistory 생성
          const changeType = REASON_TO_CHANGE_TYPE[request.reasonCategory] ?? 'OTHER'

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
            },
          })

          // 시행일이 오늘 이전이면 직접 급여 업데이트는 별도 처리 필요
          // (isScheduled 필드가 CompensationHistory에 있으면 설정)

          const updated = await tx.offCycleCompRequest.update({
            where: { id },
            data: {
              status: 'APPROVED',
              currentStep: stepData.length,
              totalSteps: stepData.length,
              submittedAt: now,
              completedAt: now,
              compensationHistoryId: compHistory.id,
            },
          })

          return updated
        } else {
          // PENDING_APPROVAL 설정
          const updated = await tx.offCycleCompRequest.update({
            where: { id },
            data: {
              status: 'PENDING_APPROVAL',
              currentStep: firstPendingIdx + 1, // 1-based
              totalSteps: stepData.length,
              submittedAt: now,
            },
          })

          return updated
        }
      })

      // TODO: eventBus.publish(OFF_CYCLE_COMP_SUBMITTED, { requestId: id, allAutoApproved })

      return apiSuccess({
        id: result.id,
        status: result.status,
        currentStep: result.currentStep,
        totalSteps: result.totalSteps,
        submittedAt: result.submittedAt,
        completedAt: result.completedAt,
        compensationHistoryId: result.compensationHistoryId,
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPENSATION, ACTION.UPDATE),
)
