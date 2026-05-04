// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/PATCH/DELETE /api/v1/recruitment/requisitions/[id]
// B4: 채용 요청 상세 조회 + 수정 + 삭제(취소)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, conflict, notFound, handlePrismaError } from '@/lib/errors'
import { withAuth, withPermission, perm, hasPermission } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { isRequisitionApproverAllowed } from '@/lib/approval/validate-requisition-approver'
import type { SessionUser } from '@/types'

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  headcount: z.number().int().min(1).optional(),
  jobLevel: z.string().optional(),
  employmentType: z.enum(['permanent', 'contract', 'intern']).optional(),
  justification: z.string().optional(),
  requirements: z.any().optional(),
  urgency: z.enum(['urgent', 'normal', 'low']).optional(),
  targetDate: z.string().optional(),
  positionId: z.string().uuid().optional().nullable(),
  status: z.enum(['cancelled']).optional(), // 취소만 허용
})

// ─── GET ────────────────────────────────────────────────────
// Session 202: recruitment_view 미보유 사용자도 자신이 결재해야 할
// 요청은 조회 가능해야 함 (dept_head MANAGER 등). 권한 분기:
//   1) recruitment_view 보유 → 무제한 조회 (기존 동작)
//   2) 미보유 → 현재 결재 단계의 승인자일 때만 조회 허용
export const GET = withAuth(
  async (_req: NextRequest, { params }: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await params

    // Cross-tenant existence oracle 차단: SUPER_ADMIN 외엔 자체 법인만.
    const requisition = await prisma.requisition.findFirst({
      where: {
        id,
        ...(user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }),
      },
      include: {
        company: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        requester: {
          select: { id: true, name: true, nameEn: true, photoUrl: true },
        },
        position: { select: { id: true, titleKo: true, titleEn: true, code: true } },
        approvalRecords: {
          orderBy: { stepOrder: 'asc' },
          include: {
            approver: { select: { id: true, name: true, photoUrl: true } },
          },
        },
        jobPostings: {
          select: { id: true, title: true, status: true, postedAt: true },
        },
      },
    })

    if (!requisition) throw notFound('채용 요청을 찾을 수 없습니다.')

    if (!hasPermission(user, perm(MODULE.RECRUITMENT, ACTION.VIEW))) {
      // 자신이 결재자(requester) 또는 현재 단계 승인자인지 확인.
      const isRequester = requisition.requester?.id === user.employeeId
      const currentRecord = requisition.approvalRecords.find(
        (r) => r.stepOrder === requisition.currentStep && r.status === 'pending',
      )
      const isCurrentApprover =
        !!currentRecord &&
        (await isRequisitionApproverAllowed({
          user,
          approverRole: currentRecord.approverRole,
          requisition: {
            companyId: requisition.companyId,
            departmentId: requisition.departmentId,
            requesterId: requisition.requesterId,
          },
        }))
      if (!isRequester && !isCurrentApprover) {
        // 정보 leak 방지 (Codex Gate 2 P2): notFound로 마스킹.
        // viewer가 아닌 사용자에겐 존재 여부 자체를 노출하지 않음.
        throw notFound('채용 요청을 찾을 수 없습니다.')
      }
    }

    return apiSuccess(requisition)
  },
)

// ─── PATCH ──────────────────────────────────────────────────
export const PATCH = withPermission(
  async (req: NextRequest, { params }: { params: Promise<Record<string, string>> }, _user: SessionUser) => {
    const { id } = await params
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)

    const existing = await prisma.requisition.findUnique({ where: { id } })
    if (!existing) throw notFound('채용 요청을 찾을 수 없습니다.')

    // draft 상태에서만 수정 가능
    if (existing.status !== 'draft' && !parsed.data.status) {
      throw badRequest('결재 중인 채용 요청은 수정할 수 없습니다.')
    }

    try {
      const updated = await prisma.requisition.update({
        where: { id },
        data: {
          ...(parsed.data.title && { title: parsed.data.title }),
          ...(parsed.data.headcount && { headcount: parsed.data.headcount }),
          ...(parsed.data.jobLevel !== undefined && { jobLevel: parsed.data.jobLevel }),
          ...(parsed.data.employmentType && { employmentType: parsed.data.employmentType }),
          ...(parsed.data.justification && { justification: parsed.data.justification }),
          ...(parsed.data.requirements !== undefined && { requirements: parsed.data.requirements }),
          ...(parsed.data.urgency && { urgency: parsed.data.urgency }),
          ...(parsed.data.targetDate && { targetDate: new Date(parsed.data.targetDate) }),
          ...(parsed.data.positionId !== undefined && { positionId: parsed.data.positionId }),
          ...(parsed.data.status && { status: parsed.data.status }),
        },
      })
      return apiSuccess(updated)
    } catch (err) {
      throw handlePrismaError(err)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.UPDATE),
)

// ─── DELETE ───────────────────────────────────────────────
// draft 또는 cancelled 상태만 삭제 가능. 연결된 공고가 있으면 삭제 불가.
export const DELETE = withPermission(
  async (req: NextRequest, { params }: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await params

    const companyFilter =
      user.role === ROLE.SUPER_ADMIN
        ? {}
        : { companyId: user.companyId }

    const existing = await prisma.requisition.findFirst({
      where: { id, ...companyFilter },
      include: {
        jobPostings: { select: { id: true } },
      },
    })

    if (!existing) throw notFound('채용 요청을 찾을 수 없습니다.')

    if (['filled', 'approved'].includes(existing.status)) {
      throw conflict('이미 진행 중인 요청은 삭제할 수 없습니다.')
    }

    if (!['draft', 'cancelled', 'rejected'].includes(existing.status)) {
      throw badRequest(
        `현재 상태(${existing.status})에서는 삭제할 수 없습니다. draft/cancelled/rejected 상태만 삭제 가능합니다.`,
      )
    }

    // 연결된 공고에 지원자가 있으면 삭제 불가 (explicit count query for reliability)
    if (existing.jobPostings.length > 0) {
      const postingIds = existing.jobPostings.map((p) => p.id)
      const applicationCount = await prisma.application.count({
        where: { postingId: { in: postingIds } },
      })
      if (applicationCount > 0) {
        throw conflict(
          `지원자(${applicationCount}명)가 있어 삭제할 수 없습니다. 먼저 지원 내역을 처리해주세요.`,
        )
      }
    }

    try {
      // 공고가 있지만 지원자 없으면 함께 삭제
      const postingIds = existing.jobPostings.map((p) => p.id)

      await prisma.$transaction([
        ...(postingIds.length > 0
          ? [prisma.jobPosting.deleteMany({ where: { id: { in: postingIds } } })]
          : []),
        prisma.requisitionApproval.deleteMany({ where: { requisitionId: id } }),
        prisma.requisition.delete({ where: { id } }),
      ])

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'recruitment.requisition.delete',
        resourceType: 'requisition',
        resourceId: id,
        companyId: existing.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({ message: '채용 요청이 삭제되었습니다.' })
    } catch (err) {
      throw handlePrismaError(err)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.DELETE),
)
