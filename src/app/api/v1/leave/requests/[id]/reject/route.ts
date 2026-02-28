// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Request Reject API
// PUT /api/v1/leave/requests/[id]/reject
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const rejectionSchema = z.object({
  rejectionReason: z.string().min(1, '반려 사유를 입력해주세요').max(500),
})

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    // 1. Parse rejection reason
    const body = await req.json()
    const parsed = rejectionSchema.safeParse(body)

    if (!parsed.success) {
      throw badRequest('반려 사유를 입력해주세요.', {
        issues: parsed.error.issues,
      })
    }

    // 2. Find PENDING request
    const request = await prisma.leaveRequest.findFirst({
      where: { id, status: 'PENDING' },
    })

    if (!request) {
      throw notFound('승인 대기 중인 휴가 신청을 찾을 수 없습니다.')
    }

    // 3. Find corresponding balance
    const balance = await prisma.employeeLeaveBalance.findFirst({
      where: {
        employeeId: request.employeeId,
        policyId: request.policyId,
        year: new Date(request.startDate).getFullYear(),
      },
    })

    if (!balance) {
      throw badRequest('해당 휴가 유형의 잔여일 정보를 찾을 수 없습니다.')
    }

    // 4. Transaction: reject request + restore pendingDays
    const updated = await prisma.$transaction(async (tx) => {
      const rejected = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: parsed.data.rejectionReason,
          approvedBy: user.employeeId,
          approvedAt: new Date(),
        },
      })

      await tx.employeeLeaveBalance.update({
        where: { id: balance.id },
        data: {
          pendingDays: { decrement: Number(request.days) },
        },
      })

      return rejected
    })

    // 5. Audit log
    const meta = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'leave.request.reject',
      resourceType: 'LeaveRequest',
      resourceId: id,
      companyId: request.companyId,
      changes: {
        status: 'REJECTED',
        rejectionReason: parsed.data.rejectionReason,
        approvedBy: user.employeeId,
      },
      ...meta,
    })

    return apiSuccess(updated)
  },
  perm(MODULE.LEAVE, ACTION.APPROVE),
)
