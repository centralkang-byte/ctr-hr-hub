// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Delegation Not Set Nudge Rule
// src/lib/nudge/rules/delegation-not-set.rule.ts
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: nudge rule — delegation not set
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════
//
// 조건: 매니저 역할인데 active delegation이 없고,
//       PENDING leave request가 3건 이상 있을 때
// 대상: 해당 매니저
// 임계값: triggerAfterDays=0, repeatEveryDays=7, maxNudges=2
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type { NudgeRule, OverdueItem } from '../types'

export const delegationNotSetRule: NudgeRule = {
  ruleId:      'delegation-not-set',
  description: '대결 설정 미완료 — 미처리 건이 쌓여 있는 매니저',
  sourceModel: 'LeaveRequest',

  thresholds: {
    triggerAfterDays: 0,
    repeatEveryDays:  7,
    maxNudges:        2,
  },

  triggerType: 'nudge_delegation_not_set',

  buildTitle(): string {
    return '📋 대결 설정을 확인해 주세요'
  },

  buildBody(_item: OverdueItem, _daysOverdue: number): string {
    return '미처리 승인 건이 3건 이상입니다. 부재 시 업무 중단을 방지하려면 대결 설정을 해주세요.'
  },

  getTitleKey(_item: OverdueItem): string {
    return 'notifications.nudge.delegationNotSet.title'
  },
  getBodyKey(_item: OverdueItem): string {
    return 'notifications.nudge.delegationNotSet.body'
  },
  getBodyParams(_item: OverdueItem, _daysOverdue: number): Record<string, string | number> {
    return {}
  },

  async findOverdueItems(
    companyId: string,
    assigneeId: string,
  ): Promise<OverdueItem[]> {
    // 1. 매니저인지 확인
    const actor = await prisma.employee.findFirst({
      where: { id: assigneeId },
      include: {
        employeeRoles: {
          include: { role: true },
          take: 5,
        },
      },
    })
    if (!actor) return []

    const isManager = actor.employeeRoles.some(
      (er) => ['MANAGER', 'EXECUTIVE'].includes(er.role.code),
    )
    if (!isManager) return []

    // 2. 이미 active delegation이 있으면 건너뛰기
    const now = new Date()
    const activeDelegation = await prisma.approvalDelegation.findFirst({
      where: {
        delegatorId: assigneeId,
        companyId,
        status: 'ACTIVE',
        startDate: { lte: now },
        endDate: { gte: now },
      },
    })
    if (activeDelegation) return []

    // 3. PENDING leave requests 건수 확인
    const pendingCount = await prisma.leaveRequest.count({
      where: {
        companyId,
        status: 'PENDING',
        approvedById: assigneeId,
      },
    })

    if (pendingCount < 3) return []

    return [{
      sourceId:     `delegation-nudge-${assigneeId}`,
      sourceModel:  'ApprovalDelegation',
      recipientIds: [assigneeId],
      createdAt:    now,
      displayTitle: `미처리 승인 ${pendingCount}건`,
      actionUrl:    '/delegation/settings',
      meta: {
        pendingCount,
      },
    }]
  },
}
