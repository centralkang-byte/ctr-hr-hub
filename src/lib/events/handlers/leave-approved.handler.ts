// ═══════════════════════════════════════════════════════════
// CTR HR Hub — LEAVE_APPROVED Handler
// src/lib/events/handlers/leave-approved.handler.ts
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: updates leave balance when leave is approved
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════
//
// Side-effects on LEAVE_APPROVED:
//   1. [TX] EmployeeLeaveBalance: usedDays++, pendingDays--
//   2. [ASYNC] Notification to employee
//
// 현재 approve/route.ts에 hardcode된 로직을 이벤트 핸들러로 추출.
// (실제 route 교체는 별도 세션에서 진행 — 이 파일은 핸들러 stub)
// ═══════════════════════════════════════════════════════════

import { sendNotification } from '@/lib/notifications'
import type { DomainEventHandler, LeaveApprovedPayload, TxClient } from '../types'
import { DOMAIN_EVENTS } from '../types'

export const leaveApprovedHandler: DomainEventHandler<'LEAVE_APPROVED'> = {
  eventName: DOMAIN_EVENTS.LEAVE_APPROVED,

  async handle(payload: LeaveApprovedPayload, tx?: TxClient): Promise<void> {
    if (tx) {
      // 1. [TX] Balance deduction: pending → used (only inside transaction)
      await tx.employeeLeaveBalance.update({
        where: { id: payload.balanceId },
        data: {
          usedDays:    { increment: payload.days },
          pendingDays: { decrement: payload.days },
        },
      })
    } else {
      // 2. [ASYNC] Employee notification (fire-and-forget — outside transaction)
      void sendNotification({
        employeeId:  payload.employeeId,
        triggerType: 'leave_approved',
        title:       '휴가 신청이 승인되었습니다',
        body:        `${payload.startDate.toISOString().slice(0, 10)} ~ ${payload.endDate.toISOString().slice(0, 10)} 휴가가 승인되었습니다.`,
        titleKey:    'notifications.leaveApproved.title',
        bodyKey:     'notifications.leaveApproved.body',
        bodyParams:  { startDate: payload.startDate.toISOString().slice(0, 10), endDate: payload.endDate.toISOString().slice(0, 10) },
        link:        '/my/leave',
        priority:    'normal',
      })
    }
  },
}
