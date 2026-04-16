// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Pending Approval Nudge Rule
// src/lib/nudge/rules/leave-pending.rule.ts
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: nudge rule — leave pending
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════
//
// 조건: LeaveRequest.status = 'PENDING' AND createdAt < cutoffDate
// 대상: request.approvedById (매니저) — 미지정이면 HR_ADMINs
// 임계값: triggerAfterDays=3, repeatEveryDays=2, maxNudges=3
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type { NudgeRule, OverdueItem } from '../types'

export const leavePendingRule: NudgeRule = {
  ruleId:      'leave-pending-approval',
  description: '휴가 승인 대기 중 — 담당자에게 리마인더',
  sourceModel: 'LeaveRequest',

  thresholds: {
    triggerAfterDays: 3,   // 신청 후 3일 이상 미처리
    repeatEveryDays:  2,   // 이후 2일마다 반복
    maxNudges:        3,   // 최대 3회 (6일간 알림 후 중단)
  },

  triggerType: 'nudge_leave_pending',

  buildTitle(_item: OverdueItem): string {
    return '⏰ 휴가 승인 대기 중'
  },

  buildBody(item: OverdueItem, daysOverdue: number): string {
    return `${item.displayTitle} — ${daysOverdue}일째 승인 대기 중입니다. 확인이 필요합니다.`
  },

  getTitleKey(_item: OverdueItem): string {
    return 'notifications.nudge.leavePending.title'
  },
  getBodyKey(_item: OverdueItem): string {
    return 'notifications.nudge.leavePending.body'
  },
  getBodyParams(item: OverdueItem, daysOverdue: number): Record<string, string | number> {
    return { displayTitle: item.displayTitle, daysOverdue }
  },

  async findOverdueItems(
    companyId: string,
    assigneeId: string,
    cutoffDate: Date,
  ): Promise<OverdueItem[]> {
    // 1. 로그인 사용자의 employee 정보 (역할 확인)
    const actor = await prisma.employee.findFirst({
      where:  { id: assigneeId },
      select: { id: true },
    })
    if (!actor) return []

    // 2. 로그인 유저가 직접 승인권자인 PENDING 건 + 승인권자 미지정인 건
    const pendingRequests = await prisma.leaveRequest.findMany({
      where: {
        companyId,
        status: 'PENDING',
        createdAt: { lt: cutoffDate },
        OR: [
          { approvedById: assigneeId },
          { approvedById: null },         // 미지정 — HR에게 fallback
        ],
      },
      include: {
        employee:  { select: { name: true } },
        policy:    { select: { name: true } },
      },
      take: 50,
    })

    return pendingRequests.map((req) => ({
      sourceId:      req.id,
      sourceModel:   'LeaveRequest',
      recipientIds:  [assigneeId],
      createdAt:     req.createdAt,
      displayTitle:  `${req.employee?.name ?? '직원'} — ${req.policy?.name ?? '휴가'} ${Number(req.days)}일`,
      actionUrl:     '/leave/team',
      meta: {
        employeeName: req.employee?.name,
        policyName:   req.policy?.name,
        days:         Number(req.days),
        startDate:    req.startDate.toISOString().slice(0, 10),
        endDate:      req.endDate.toISOString().slice(0, 10),
      },
    }))
  },
}
