// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/recruitment/requisitions/[id]/approve
// B4: 채용 요청 결재 (승인/반려)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const approveSchema = z.object({
  action: z.enum(['approve', 'reject']),
  comment: z.string().optional(),
})

export const POST = withPermission(
  async (req: NextRequest, { params }: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await params
    const body = await req.json()
    const parsed = approveSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)

    const { action, comment } = parsed.data

    const requisition = await prisma.requisition.findUnique({
      where: { id },
      include: {
        approvalRecords: { orderBy: { stepOrder: 'asc' } },
        position: true,
      },
    })
    if (!requisition) throw notFound('채용 요청을 찾을 수 없습니다.')
    if (requisition.status !== 'pending') {
      throw badRequest('결재 대기 중이 아닌 채용 요청입니다.')
    }

    // 현재 단계 결재 레코드 찾기
    const currentRecord = requisition.approvalRecords.find(
      (r) => r.stepOrder === requisition.currentStep && r.status === 'pending',
    )
    if (!currentRecord) throw badRequest('현재 결재 단계를 찾을 수 없습니다.')

    try {
      if (action === 'reject') {
        // 반려: 요청 전체 반려
        await prisma.$transaction([
          prisma.requisitionApproval.update({
            where: { id: currentRecord.id },
            data: {
              status: 'rejected',
              approverId: user.id,
              comment: comment ?? null,
              decidedAt: new Date(),
            },
          }),
          prisma.requisition.update({
            where: { id },
            data: { status: 'rejected' },
          }),
        ])

        return apiSuccess({ status: 'rejected', message: '채용 요청이 반려되었습니다.' })
      }

      // 승인
      const totalSteps = requisition.approvalRecords.length
      const isLastStep = requisition.currentStep >= totalSteps

      await prisma.requisitionApproval.update({
        where: { id: currentRecord.id },
        data: {
          status: 'approved',
          approverId: user.id,
          comment: comment ?? null,
          decidedAt: new Date(),
        },
      })

      if (isLastStep) {
        // 최종 승인 → 공고 초안 자동 생성
        await prisma.requisition.update({
          where: { id },
          data: { status: 'approved' },
        })

        // Position이 없으면 신규 생성
        let positionId = requisition.positionId
        if (!positionId) {
          const newPos = await prisma.position.create({
            data: {
              code: `POS-${requisition.reqNumber}`,
              titleKo: requisition.title,
              titleEn: requisition.title,
              companyId: requisition.companyId,
              departmentId: requisition.departmentId,
              isActive: true,
              isFilled: false,
            },
          })
          positionId = newPos.id
          await prisma.requisition.update({
            where: { id },
            data: { positionId },
          })
        }

        // Job Posting 초안 자동 생성
        const empTypeMap: Record<string, string> = {
          permanent: 'FULL_TIME',
          contract: 'CONTRACT',
          intern: 'INTERN',
        }
        const jobPosting = await prisma.jobPosting.create({
          data: {
            companyId: requisition.companyId,
            departmentId: requisition.departmentId,
            title: requisition.title,
            description: requisition.justification,
            requirements: requisition.requirements
              ? JSON.stringify(requisition.requirements)
              : null,
            employmentType: (empTypeMap[requisition.employmentType] ?? 'FULL_TIME') as any,
            headcount: requisition.headcount,
            status: 'DRAFT',
            createdById: requisition.requesterId,
            positionId,
            requisitionId: id,
          },
        })

        return apiSuccess({
          status: 'approved',
          message: '최종 승인 완료. 공고 초안이 생성되었습니다.',
          jobPostingId: jobPosting.id,
        })
      } else {
        // 다음 단계로 진행
        await prisma.requisition.update({
          where: { id },
          data: { currentStep: requisition.currentStep + 1 },
        })
        return apiSuccess({
          status: 'step_approved',
          nextStep: requisition.currentStep + 1,
          message: `${requisition.currentStep}단계 승인 완료. 다음 단계로 진행됩니다.`,
        })
      }
    } catch (err) {
      throw handlePrismaError(err)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.UPDATE),
)
