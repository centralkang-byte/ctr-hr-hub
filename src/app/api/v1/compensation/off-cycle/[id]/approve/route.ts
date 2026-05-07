// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Off-Cycle Compensation Approve
// POST /api/v1/compensation/off-cycle/[id]/approve
//
// PENDING_APPROVAL → (다음 단계 or APPROVED)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, conflict, notFound, forbidden, handlePrismaError } from '@/lib/errors'
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

      // Finalize 여부는 "남은 PENDING step"으로 판단 — `currentStep >= totalSteps` 단순
      // 비교는 submit 시점의 self-skip(발의자가 후속 step 결재자와 동일)으로 trailing
      // step이 미리 APPROVED된 경우 stuck. 예: flow=[direct_manager, hr_admin], HR_ADMIN
      // 이 발의 → step2 self-skip APPROVED, step1 PENDING. 매니저가 step1 결재 시
      // currentStep=1<2라 intermediate 분기로 가서 currentStep=2로만 advance, step2가
      // 이미 APPROVED라 더 이상 결재 트리거 없음 → PENDING_APPROVAL stuck (Session 207
      // hr_admin routing 정합화 후 surface된 회귀, off-cycle-lifecycle.spec.ts:90).
      // Fix: 트랜잭션 안에서 현재 step approve 후 남은 PENDING 조회. 없으면 finalize.
      const result = await prisma.$transaction(async (tx) => {
        // Atomic transition: PENDING → APPROVED with race protection (Codex Gate 2 P1).
        // updateMany + `status: 'PENDING'` 조건 → READ COMMITTED 격리에서 row lock으로
        // 동시 결재 양쪽 finalize → CompensationHistory 중복 row 회귀 차단. 첫 tx만
        // count=1, 둘째 tx는 첫 commit 후 row가 APPROVED로 보여 count=0 → race lost.
        const stepUpdate = await tx.offCycleApprovalStep.updateMany({
          where: { id: currentStepRecord.id, status: 'PENDING' },
          data: { status: 'APPROVED', approverId: user.employeeId, comment: comment ?? null, decidedAt: now },
        })

        if (stepUpdate.count === 0) {
          // 동시 결재 race 패배 — 다른 결재자가 이미 처리.
          return { raceLost: true } as const
        }

        // 남은 PENDING step 조회 (auto-skip된 trailing/middle step 자연 흡수).
        const nextPending = await tx.offCycleApprovalStep.findFirst({
          where: { requestId: id, status: 'PENDING' },
          orderBy: { stepNumber: 'asc' },
        })

        if (nextPending) {
          // 중간 단계: 다음 PENDING step으로 currentStep 이동.
          const updated = await tx.offCycleCompRequest.update({
            where: { id },
            data: { currentStep: nextPending.stepNumber },
          })
          return { finalized: false, rejected: false, raceLost: false, request: updated }
        }

        // 모든 step approved → finalize. Salary drift guard 적용.
        const latestComp = await tx.compensationHistory.findFirst({
          where: { employeeId: request.employeeId, companyId: request.companyId },
          orderBy: { effectiveDate: 'desc' },
          select: { newBaseSalary: true },
        })

        const currentSalary = latestComp ? Number(latestComp.newBaseSalary) : 0
        const requestedCurrent = Number(request.currentBaseSalary)

        if (currentSalary !== requestedCurrent) {
          // 급여가 변경됨 → 방금 결재한 step을 REJECTED로 되돌림 + request REJECTED.
          await tx.offCycleApprovalStep.update({
            where: { id: currentStepRecord.id },
            data: { status: 'REJECTED', approverId: user.employeeId, comment: '기존 연봉 정보 변경으로 자동 거부', decidedAt: now },
          })

          const rejected = await tx.offCycleCompRequest.update({
            where: { id },
            data: { status: 'REJECTED', completedAt: now },
          })

          return { finalized: true, rejected: true, raceLost: false, request: rejected }
        }

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

        // 요청 완료 처리. currentStep을 totalSteps로 advance해 submit의 all-auto-approved
        // 분기(currentStep=stepData.length)와 동일 progress 표현 — auto-skip된 trailing
        // step 흡수로 finalize했을 때 client가 `1/2` stale 표시 보지 않도록 (Codex Gate 2
        // R2 P2). detail/list API의 currentStep===totalSteps completion check 정합.
        const updated = await tx.offCycleCompRequest.update({
          where: { id },
          data: {
            status: 'APPROVED',
            currentStep: request.totalSteps,
            completedAt: now,
            compensationHistoryId: compHistory.id,
          },
        })

        return { finalized: true, rejected: false, raceLost: false, request: updated, compensationHistoryId: compHistory.id }
      })

      if (result.raceLost) {
        throw conflict('이미 처리된 결재 단계입니다.')
      }

      if (result.rejected) {
        throw badRequest('기존 연봉 정보가 변경되었습니다. 요청서를 갱신하세요.')
      }

      if (result.finalized) {
        // TODO: eventBus.publish(OFF_CYCLE_COMP_APPROVED, { requestId: id })
        return apiSuccess({
          id: result.request.id,
          status: result.request.status,
          completedAt: result.request.completedAt,
          compensationHistoryId: result.compensationHistoryId,
        })
      }

      return apiSuccess({
        id: result.request.id,
        status: result.request.status,
        currentStep: result.request.currentStep,
        totalSteps: result.request.totalSteps,
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPENSATION, ACTION.APPROVE),
)
