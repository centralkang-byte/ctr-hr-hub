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
import { sendNotification } from '@/lib/notifications'
import { checkDelegation } from '@/lib/delegation/resolve-delegatee'
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

    // 2. Find PENDING request — scope to caller's company (prevents IDOR)
    const request = await prisma.leaveRequest.findFirst({
      where: { id, status: 'PENDING', companyId: user.companyId },
    })

    if (!request) {
      throw notFound('승인 대기 중인 휴가 신청을 찾을 수 없습니다.')
    }

    // F-2: Delegation check
    let delegatedBy: string | null = null
    const isDirectApprover =
      !request.approvedBy ||
      request.approvedBy === user.employeeId ||
      ['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)

    if (!isDirectApprover) {
      const delegationResult = await checkDelegation(
        user.employeeId,
        request.approvedBy!,
        user.companyId,
        'LEAVE_ONLY',
      )
      if (!delegationResult.isDelegatee) {
        throw badRequest('이 휴가 신청에 대한 반려 권한이 없습니다.')
      }
      delegatedBy = user.employeeId
    }

    // 3. Find corresponding balance
    const balance = await prisma.employeeLeaveBalance.findFirst({
      where: {
        employeeId: request.employeeId,
        policyId:   request.policyId,
        year:       new Date(request.startDate).getFullYear(),
      },
    })

    if (!balance) {
      throw badRequest('해당 휴가 유형의 잔여일 정보를 찾을 수 없습니다.')
    }

    // 4. Transaction: reject request + restore pendingDays (direct, not via event)
    const days = Number(request.days)

    const updated = await prisma.$transaction(async (tx) => {
      const rejected = await tx.leaveRequest.update({
        where: { id },
        data: {
          status:          'REJECTED',
          rejectionReason: parsed.data.rejectionReason,
          approvedBy:      request.approvedBy ?? user.employeeId,
          approvedAt:      new Date(),
          delegatedBy:     delegatedBy,
        },
      })

      // Restore pendingDays (usedDays unchanged for rejection)
      await tx.employeeLeaveBalance.update({
        where: { id: balance.id },
        data: { pendingDays: { decrement: days } },
      })

      return rejected
    })

    // 5. Fetch updated balance for response
    const updatedBalance = await prisma.employeeLeaveBalance.findUnique({
      where: { id: balance.id },
    })
    const remaining = updatedBalance
      ? Number(updatedBalance.grantedDays) +
        Number(updatedBalance.carryOverDays) -
        Number(updatedBalance.usedDays) -
        Number(updatedBalance.pendingDays)
      : 0

    // 6. Audit log
    const meta = extractRequestMeta(req.headers)
    logAudit({
      actorId:      user.employeeId,
      action:       'leave.request.reject',
      resourceType: 'LeaveRequest',
      resourceId:   id,
      companyId:    request.companyId,
      changes: {
        status:          'REJECTED',
        rejectionReason: parsed.data.rejectionReason,
        approvedBy:      user.employeeId,
      },
      ...meta,
    })

    // 7. Fire-and-forget notification (sent directly to avoid double balance update)
    void sendNotification({
      employeeId:  request.employeeId,
      triggerType: 'leave_rejected',
      title:       '휴가 신청이 반려되었습니다',
      body:        `반려 사유: ${parsed.data.rejectionReason}`,
      link:        '/my/leave',
      priority:    'normal',
    })

    return apiSuccess({
      request: updated,
      balance: {
        granted:   Number(updatedBalance?.grantedDays ?? 0),
        used:      Number(updatedBalance?.usedDays ?? 0),
        pending:   Number(updatedBalance?.pendingDays ?? 0),
        remaining,
      },
    })
  },
  perm(MODULE.LEAVE, ACTION.UPDATE),
)
