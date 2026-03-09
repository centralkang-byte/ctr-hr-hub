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
import { eventBus, DOMAIN_EVENTS } from '@/lib/events'
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

    // FIX: Issue #2 — Year boundary: try startDate year first, then endDate year
    //   for cross-year leaves (e.g., Dec 30 – Jan 2).
    const startYear = new Date(request.startDate).getFullYear()
    const endYear   = new Date(request.endDate).getFullYear()

    let balance = await prisma.employeeLeaveBalance.findFirst({
      where: {
        employeeId: request.employeeId,
        policyId:   request.policyId,
        year:       startYear,
      },
    })

    if (!balance && endYear !== startYear) {
      balance = await prisma.employeeLeaveBalance.findFirst({
        where: {
          employeeId: request.employeeId,
          policyId:   request.policyId,
          year:       endYear,
        },
      })
    }

    if (!balance) {
      throw badRequest('해당 휴가 유형의 잔여일 정보를 찾을 수 없습니다.')
    }

    // 4. Transaction: cancel request + event (balance restore via handler)
    const previousStatus = request.status as 'PENDING' | 'APPROVED'
    const ctx = { companyId: request.companyId, actorId: user.employeeId, occurredAt: new Date() }
    const eventPayload = {
      ctx,
      requestId:      request.id,
      employeeId:     request.employeeId,
      policyId:       request.policyId,
      balanceId:      balance.id,
      days:           Number(request.days),
      previousStatus,
    }

    const updated = await prisma.$transaction(async (tx) => {
      const cancelled = await tx.leaveRequest.update({
        where: { id },
        data: { status: 'CANCELLED' },
      })

      // Side-effect: pendingDays-- or usedDays-- (handled by leaveCancelledHandler)
      await eventBus.publish(DOMAIN_EVENTS.LEAVE_CANCELLED, eventPayload, tx)

      return cancelled
    })

    // 5. Audit log
    const meta = extractRequestMeta(req.headers)
    logAudit({
      actorId:      user.employeeId,
      action:       'leave.request.cancel',
      resourceType: 'LeaveRequest',
      resourceId:   id,
      companyId:    request.companyId,
      changes: {
        previousStatus: request.status,
        status:         'CANCELLED',
      },
      ...meta,
    })

    return apiSuccess(updated)
  },
  perm(MODULE.LEAVE, ACTION.VIEW),
)
