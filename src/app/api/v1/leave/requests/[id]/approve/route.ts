// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Request Approve API
// PUT /api/v1/leave/requests/[id]/approve
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    // 1. Find PENDING request
    const request = await prisma.leaveRequest.findFirst({
      where: { id, status: 'PENDING' },
    })

    if (!request) {
      throw notFound('승인 대기 중인 휴가 신청을 찾을 수 없습니다.')
    }

    // 2. Find corresponding balance
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

    // 3. Transaction: approve request + update balance
    const updated = await prisma.$transaction(async (tx) => {
      const approved = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy: user.employeeId,
          approvedAt: new Date(),
        },
      })

      await tx.employeeLeaveBalance.update({
        where: { id: balance.id },
        data: {
          usedDays: { increment: Number(request.days) },
          pendingDays: { decrement: Number(request.days) },
        },
      })

      return approved
    })

    // 4. Audit log
    const meta = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'leave.request.approve',
      resourceType: 'LeaveRequest',
      resourceId: id,
      companyId: request.companyId,
      changes: {
        status: 'APPROVED',
        approvedBy: user.employeeId,
      },
      ...meta,
    })

    return apiSuccess(updated)
  },
  perm(MODULE.LEAVE, ACTION.APPROVE),
)
