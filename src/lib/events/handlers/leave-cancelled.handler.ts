// ═══════════════════════════════════════════════════════════
// CTR HR Hub — LEAVE_CANCELLED Handler
// src/lib/events/handlers/leave-cancelled.handler.ts
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: reverses leave balance when leave is cancelled
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════
//
// Side-effects on LEAVE_CANCELLED:
//   1. [TX] EmployeeLeaveBalance:
//      - previousStatus === 'PENDING'  → pendingDays--
//      - previousStatus === 'APPROVED' → usedDays--
//   2. [ASYNC] (선택적) Notification (현재 cancel route에는 없음 — 향후 확장)
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type { DomainEventHandler, LeaveCancelledPayload, TxClient } from '../types'
import { DOMAIN_EVENTS } from '../types'

export const leaveCancelledHandler: DomainEventHandler<'LEAVE_CANCELLED'> = {
  eventName: DOMAIN_EVENTS.LEAVE_CANCELLED,

  async handle(payload: LeaveCancelledPayload, tx?: TxClient): Promise<void> {
    const db = tx ?? prisma

    if (payload.previousStatus === 'PENDING') {
      // PENDING 취소: pendingDays 복원
      await db.employeeLeaveBalance.update({
        where: { id: payload.balanceId },
        data: { pendingDays: { decrement: payload.days } },
      })
    } else if (payload.previousStatus === 'APPROVED') {
      // APPROVED 취소: usedDays 복원
      await db.employeeLeaveBalance.update({
        where: { id: payload.balanceId },
        data: { usedDays: { decrement: payload.days } },
      })
    }
  },
}
