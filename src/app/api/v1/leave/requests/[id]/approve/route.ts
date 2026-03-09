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
import { eventBus, DOMAIN_EVENTS } from '@/lib/events'
import type { SessionUser } from '@/types'

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    // 1. Find PENDING request — scope to caller's company (prevents IDOR)
    const request = await prisma.leaveRequest.findFirst({
      where: { id, status: 'PENDING', companyId: user.companyId },
    })

    if (!request) {
      throw notFound('승인 대기 중인 휴가 신청을 찾을 수 없습니다.')
    }

    // FIX: Issue #2 — Year boundary: cross-year leave (e.g., Dec 30 ~ Jan 2) must
    //   deduct from the year where the leave STARTS (primary) and if no balance
    //   found, try the end year (edge case where all days fall in new year).
    const startYear = new Date(request.startDate).getFullYear()
    const endYear   = new Date(request.endDate).getFullYear()

    let balance = await prisma.employeeLeaveBalance.findFirst({
      where: {
        employeeId: request.employeeId,
        policyId: request.policyId,
        year: startYear,
      },
    })

    // Cross-year leave: try endDate year if startDate year has no balance
    if (!balance && endYear !== startYear) {
      balance = await prisma.employeeLeaveBalance.findFirst({
        where: {
          employeeId: request.employeeId,
          policyId: request.policyId,
          year: endYear,
        },
      })
    }

    if (!balance) {
      throw badRequest('해당 휴가 유형의 잔여일 정보를 찾을 수 없습니다.')
    }

    // 3. Transaction: approve request + event (balance deduction via handler)
    const ctx = { companyId: user.companyId, actorId: user.employeeId, occurredAt: new Date() }
    const eventPayload = {
      ctx,
      requestId:  request.id,
      employeeId: request.employeeId,
      policyId:   request.policyId,
      balanceId:  balance.id,
      days:       Number(request.days),
      startDate:  request.startDate,
      endDate:    request.endDate,
    }

    const updated = await prisma.$transaction(async (tx) => {
      const approved = await tx.leaveRequest.update({
        where: { id },
        data: {
          status:     'APPROVED',
          approvedBy: user.employeeId,
          approvedAt: new Date(),
        },
      })

      // Side-effect: usedDays++, pendingDays-- (handled by leaveApprovedHandler)
      await eventBus.publish(DOMAIN_EVENTS.LEAVE_APPROVED, eventPayload, tx)

      return approved
    })

    // 4. Fetch updated balance for response
    const updatedBalance = await prisma.employeeLeaveBalance.findUnique({
      where: { id: balance.id },
    })
    const remaining = updatedBalance
      ? Number(updatedBalance.grantedDays) +
        Number(updatedBalance.carryOverDays) -
        Number(updatedBalance.usedDays) -
        Number(updatedBalance.pendingDays)
      : 0

    // 5. Audit log
    const meta = extractRequestMeta(req.headers)
    logAudit({
      actorId:      user.employeeId,
      action:       'leave.request.approve',
      resourceType: 'LeaveRequest',
      resourceId:   id,
      companyId:    request.companyId,
      changes: {
        status:     'APPROVED',
        approvedBy: user.employeeId,
      },
      ...meta,
    })

    // 6. Fire-and-forget notification (tx=undefined → handler sends notification only)
    void eventBus.publish(DOMAIN_EVENTS.LEAVE_APPROVED, eventPayload)

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
  perm(MODULE.LEAVE, ACTION.APPROVE),
)
