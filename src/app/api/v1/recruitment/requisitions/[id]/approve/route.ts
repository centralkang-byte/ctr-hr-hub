// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/recruitment/requisitions/[id]/approve
// B4: 채용 요청 결재 (승인/반려)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, conflict, forbidden, notFound, handlePrismaError } from '@/lib/errors'
import { withAuth, hasPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { isRequisitionApproverAllowed } from '@/lib/approval/validate-requisition-approver'
import type { SessionUser } from '@/types'

const approveSchema = z.object({
  action: z.enum(['approve', 'reject']),
  comment: z.string().optional(),
})

// Session 202: 권한 게이트는 isRequisitionApproverAllowed (per-step 검증)에 일임.
// dept_head는 Department.headEmployeeId 기반이라 role 무관 (EMPLOYEE-role 부서장
// 가능). 따라서 정적 role allowlist는 사용하지 않고, 모든 인증 사용자에 대해
// per-step 매칭으로 결정. 매치 실패 시 notFound로 마스킹 (존재 leak 방지).
// SUPER_ADMIN bypass + tenant guard는 helper 내부에 캡슐화.
export const POST = withAuth(
  async (req: NextRequest, { params }: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await params

    const body = await req.json()
    const parsed = approveSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)

    const { action, comment } = parsed.data

    // Cross-tenant existence oracle 차단: SUPER_ADMIN 외엔 자체 법인만.
    const requisition = await prisma.requisition.findFirst({
      where: {
        id,
        ...(user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }),
      },
      include: {
        approvalRecords: { orderBy: { stepOrder: 'asc' } },
        position: true,
      },
    })
    if (!requisition) throw notFound('채용 요청을 찾을 수 없습니다.')

    // 정보 leak 방지 (Codex Gate 2 P2): recruitment_view 미보유자는 status/단계
    // 정보를 alone-standing 응답으로 받지 못하도록 모든 auth 실패를 notFound로 마스킹.
    // viewer(HR_ADMIN/SUPER_ADMIN)는 디버깅용 정확한 에러 유지.
    const isViewer = hasPermission(user, perm(MODULE.RECRUITMENT, ACTION.VIEW))

    if (requisition.status !== 'pending') {
      if (isViewer) throw badRequest('결재 대기 중이 아닌 채용 요청입니다.')
      throw notFound('채용 요청을 찾을 수 없습니다.')
    }

    // 현재 단계 결재 레코드 찾기
    const currentRecord = requisition.approvalRecords.find(
      (r) => r.stepOrder === requisition.currentStep && r.status === 'pending',
    )
    if (!currentRecord) {
      if (isViewer) throw badRequest('현재 결재 단계를 찾을 수 없습니다.')
      throw notFound('채용 요청을 찾을 수 없습니다.')
    }

    // Per-step approver 검증: currentRecord.approverRole에 대해 사용자가 실제 승인자인지.
    // ApprovalFlow를 우회하는 임의 결재(예: HR_ADMIN이 dept_head step 처리) 차단.
    const allowed = await isRequisitionApproverAllowed({
      user,
      approverRole: currentRecord.approverRole,
      requisition: {
        companyId: requisition.companyId,
        departmentId: requisition.departmentId,
        requesterId: requisition.requesterId,
      },
    })
    if (!allowed) {
      if (isViewer) throw forbidden('현재 결재 단계의 승인자가 아닙니다.')
      throw notFound('채용 요청을 찾을 수 없습니다.')
    }

    // 동시 결재(double-click 등) race 방어: 트랜잭션 안에서 step status 'pending'→
    // 'approved'/'rejected' 전환을 `updateMany` + status 조건으로 atomic 보호. PostgreSQL
    // READ COMMITTED 격리에서 row lock으로 첫 tx만 count=1, 둘째는 status 미일치로 count=0
    // → conflict 응답. mixed approve/reject 동시 클릭 + double-click 모두 안전.
    // 격상 이전: approve 분기가 트랜잭션 밖 → currentStep + JobPosting 중복 부작용 가능.
    const now = new Date()
    try {
      if (action === 'reject') {
        const result = await prisma.$transaction(async (tx) => {
          const stepUpdate = await tx.requisitionApproval.updateMany({
            where: { id: currentRecord.id, status: 'pending' },
            data: {
              status: 'rejected',
              approverId: user.employeeId,
              comment: comment ?? null,
              decidedAt: now,
            },
          })
          if (stepUpdate.count === 0) return { raceLost: true } as const

          await tx.requisition.update({
            where: { id },
            data: { status: 'rejected' },
          })
          return { raceLost: false } as const
        })

        if (result.raceLost) throw conflict('이미 처리된 결재 단계입니다.')
        return apiSuccess({ status: 'rejected', message: '채용 요청이 반려되었습니다.' })
      }

      // 승인
      const totalSteps = requisition.approvalRecords.length
      const isLastStep = requisition.currentStep >= totalSteps

      const result = await prisma.$transaction(async (tx) => {
        const stepUpdate = await tx.requisitionApproval.updateMany({
          where: { id: currentRecord.id, status: 'pending' },
          data: {
            status: 'approved',
            approverId: user.employeeId,
            comment: comment ?? null,
            decidedAt: now,
          },
        })
        if (stepUpdate.count === 0) return { raceLost: true } as const

        if (!isLastStep) {
          await tx.requisition.update({
            where: { id },
            data: { currentStep: requisition.currentStep + 1 },
          })
          return { raceLost: false, finalized: false } as const
        }

        // 최종 승인 → 공고 초안 자동 생성 (트랜잭션 안에서 atomic)
        await tx.requisition.update({
          where: { id },
          data: { status: 'approved' },
        })

        let positionId = requisition.positionId
        if (!positionId) {
          const newPos = await tx.position.create({
            data: {
              code: `POS-${requisition.reqNumber}`,
              titleKo: requisition.title,
              titleEn: requisition.title,
              companyId: requisition.companyId,
              departmentId: requisition.departmentId,
              deletedAt: null,
              isFilled: false,
            },
          })
          positionId = newPos.id
          await tx.requisition.update({
            where: { id },
            data: { positionId },
          })
        }

        const empTypeMap: Record<string, string> = {
          permanent: 'FULL_TIME',
          contract: 'CONTRACT',
          intern: 'INTERN',
        }
        const jobPosting = await tx.jobPosting.create({
          data: {
            companyId: requisition.companyId,
            departmentId: requisition.departmentId,
            title: requisition.title,
            description: requisition.justification,
            requirements: requisition.requirements
              ? JSON.stringify(requisition.requirements)
              : null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            employmentType: (empTypeMap[requisition.employmentType] ?? 'FULL_TIME') as any,
            headcount: requisition.headcount,
            status: 'DRAFT',
            createdById: requisition.requesterId,
            positionId,
            requisitionId: id,
          },
        })
        return { raceLost: false, finalized: true, jobPostingId: jobPosting.id } as const
      })

      if (result.raceLost) throw conflict('이미 처리된 결재 단계입니다.')

      if (!result.finalized) {
        return apiSuccess({
          status: 'step_approved',
          nextStep: requisition.currentStep + 1,
          message: `${requisition.currentStep}단계 승인 완료. 다음 단계로 진행됩니다.`,
        })
      }

      return apiSuccess({
        status: 'approved',
        message: '최종 승인 완료. 공고 초안이 생성되었습니다.',
        jobPostingId: result.jobPostingId,
      })
    } catch (err) {
      throw handlePrismaError(err)
    }
  },
)
