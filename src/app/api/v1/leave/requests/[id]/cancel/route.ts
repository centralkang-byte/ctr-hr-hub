// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Request Cancel API
// PUT /api/v1/leave/requests/[id]/cancel
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

    // 1. Find request belonging to the current user
    const request = await prisma.leaveRequest.findFirst({
      where: {
        id,
        employeeId: user.employeeId,
      },
    })

    if (!request) {
      throw notFound('휴가 신청을 찾을 수 없습니다.')
    }

    // 2. Validate cancellable status
    if (request.status === 'CANCELLED' || request.status === 'REJECTED') {
      throw badRequest('이미 취소되었거나 반려된 신청은 취소할 수 없습니다.')
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

    // 4. Transaction: cancel request + adjust balance
    const updated = await prisma.$transaction(async (tx) => {
      const cancelled = await tx.leaveRequest.update({
        where: { id },
        data: { status: 'CANCELLED' },
      })

      if (request.status === 'PENDING') {
        // Pending request: restore pendingDays
        await tx.employeeLeaveBalance.update({
          where: { id: balance.id },
          data: {
            pendingDays: { decrement: Number(request.days) },
          },
        })
      } else if (request.status === 'APPROVED') {
        // Approved request: restore usedDays
        await tx.employeeLeaveBalance.update({
          where: { id: balance.id },
          data: {
            usedDays: { decrement: Number(request.days) },
          },
        })
      }

      return cancelled
    })

    // 5. Audit log
    const meta = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'leave.request.cancel',
      resourceType: 'LeaveRequest',
      resourceId: id,
      companyId: request.companyId,
      changes: {
        previousStatus: request.status,
        status: 'CANCELLED',
      },
      ...meta,
    })

    return apiSuccess(updated)
  },
  perm(MODULE.LEAVE, ACTION.CREATE),
)
