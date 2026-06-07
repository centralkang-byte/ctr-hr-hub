// src/app/api/v1/benefit-claims/[id]/route.ts
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { sendNotification } from '@/lib/notifications'
import { z } from 'zod'
import type { SessionUser } from '@/types'

const actionSchema = z.object({
  action: z.enum(['approve', 'reject', 'cancel']),
  approvedAmount: z.number().int().positive().optional(),
  rejectedReason: z.string().max(500).optional(),
})

export const GET = withPermission(
  async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const claim = await prisma.benefitClaim.findUnique({
      where: { id },
      include: {
        benefitPlan: true,
        employee: { select: { id: true, name: true, employeeNo: true, assignments: { where: { isPrimary: true, endDate: null }, take: 1, select: { companyId: true } } } },
        approver: { select: { id: true, name: true } },
      },
    })
    if (!claim) throw notFound('신청 내역을 찾을 수 없습니다.')
    // 소유 법인 = benefitPlan.companyId(글로벌 플랜이면 직원 현재 법인). self는 본인 조회 허용.
    const isSelf = claim.employeeId === user.employeeId
    const isHR = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN
    const ownerCompany = claim.benefitPlan.companyId ?? claim.employee.assignments[0]?.companyId
    const sameCompany = user.role === ROLE.SUPER_ADMIN || ownerCompany === user.companyId
    if (!isSelf && (!isHR || !sameCompany)) throw forbidden()
    return apiSuccess(claim)
  },
  perm(MODULE.BENEFITS, ACTION.VIEW),
)

export const PATCH = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body = await req.json()
    const isHR = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN

    const claim = await prisma.benefitClaim.findUnique({
      where: { id },
      include: { benefitPlan: true, employee: { select: { assignments: { where: { isPrimary: true, endDate: null }, take: 1, select: { companyId: true } } } } },
    })
    if (!claim) throw notFound('신청 내역을 찾을 수 없습니다.')
    // 소유 법인 = benefitPlan.companyId(글로벌 플랜이면 직원 현재 법인)
    const ownerCompany = claim.benefitPlan.companyId ?? claim.employee.assignments[0]?.companyId

    const parsed = actionSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)
    const { action, approvedAmount, rejectedReason } = parsed.data

    if (action === 'cancel') {
      if (claim.employeeId !== user.employeeId) throw forbidden()
      if (claim.status !== 'pending') throw badRequest('대기중 상태만 취소 가능합니다.')
      const updated = await prisma.benefitClaim.update({
        where: { id },
        data: { status: 'cancelled' },
      })
      return apiSuccess(updated)
    }

    if (!isHR) throw forbidden('HR 권한이 필요합니다.')
    if (user.role !== ROLE.SUPER_ADMIN && ownerCompany !== user.companyId) throw forbidden('다른 법인의 신청은 처리할 수 없습니다.')
    if (claim.status !== 'pending') throw badRequest('이미 처리된 신청입니다.')
    if (action === 'reject' && !rejectedReason) throw badRequest('반려 사유를 입력해 주세요.')

    const now = new Date()
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.benefitClaim.update({
        where: { id },
        data: {
          status: action === 'approve' ? 'approved' : 'rejected',
          approvedById: action === 'approve' ? (user.employeeId ?? null) : null,
          approvedAt: action === 'approve' ? now : null,
          approvedAmount: action === 'approve' ? (approvedAmount ?? claim.claimAmount) : null,
          rejectedReason: action === 'reject' ? rejectedReason : null,
        },
        include: { benefitPlan: true },
      })

      if (action === 'approve') {
        const year = now.getFullYear()
        const finalAmount = approvedAmount ?? claim.claimAmount
        await tx.benefitBudget.updateMany({
          where: {
            companyId: ownerCompany ?? user.companyId,
            year,
            category: claim.benefitPlan.category,
          },
          data: { usedAmount: { increment: finalAmount } },
        })
      }

      return result
    })

    // Fire-and-forget notification when benefit claim is approved
    if (action === 'approve') {
      void sendNotification({
        employeeId: claim.employeeId,
        triggerType: 'benefit_approved',
        title: '복리후생 신청이 승인되었습니다',
        body: `${claim.benefitPlan.name} 신청이 승인되었습니다.`,
        titleKey: 'notifications.benefitApproved.title',
        bodyKey: 'notifications.benefitApproved.body',
        bodyParams: { planName: claim.benefitPlan.name },
        link: `/my/benefits`,
        priority: 'normal',
      })
    }

    return apiSuccess(updated)
  },
  perm(MODULE.BENEFITS, ACTION.UPDATE),
)
