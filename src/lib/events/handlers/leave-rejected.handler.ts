// ═══════════════════════════════════════════════════════════
// CTR HR Hub — LEAVE_REJECTED Handler
// src/lib/events/handlers/leave-rejected.handler.ts
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: restores pending days when leave is rejected
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════
//
// Side-effects on LEAVE_REJECTED:
//   1. [TX] EmployeeLeaveBalance: pendingDays-- (used는 건드리지 않음)
//   2. [ASYNC] Notification to employee
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { sendNotification } from '@/lib/notifications'
import type { DomainEventHandler, LeaveRejectedPayload, TxClient } from '../types'
import { DOMAIN_EVENTS } from '../types'

export const leaveRejectedHandler: DomainEventHandler<'LEAVE_REJECTED'> = {
  eventName: DOMAIN_EVENTS.LEAVE_REJECTED,

  async handle(payload: LeaveRejectedPayload, tx?: TxClient): Promise<void> {
    const db = tx ?? prisma

    // 1. [TX] Restore pendingDays (usedDays 미변경)
    await db.employeeLeaveBalance.update({
      where: { id: payload.balanceId },
      data: {
        pendingDays: { decrement: payload.days },
      },
    })

    // 2. [ASYNC] Employee notification
    if (!tx) {
      void sendNotification({
        employeeId:  payload.employeeId,
        triggerType: 'leave_rejected',
        title:       '휴가 신청이 반려되었습니다',
        body:        `반려 사유: ${payload.rejectionReason}`,
        link:        '/my/leave',
        priority:    'normal',
      })
    }
  },
}
