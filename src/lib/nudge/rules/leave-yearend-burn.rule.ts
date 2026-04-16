// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Year-End Burn Reminder Nudge Rule
// src/lib/nudge/rules/leave-yearend-burn.rule.ts
//
// F-3: 연말 소진 유도
//   - Trigger: Date >= November 1 AND employee has ≥ 3 remaining annual leave days
//   - Target: Employee
//   - Active period: November 1 ~ December 25 only
//   - Interval: Every 7 days / Max: 3 times
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: nudge rule — leave yearend burn
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type { NudgeRule, OverdueItem } from '../types'

export const leaveYearendBurnRule: NudgeRule = {
  ruleId: 'leave-yearend-burn',
  description: '연말 연차 소진 유도 — 잔여 3일+ 직원에게 리마인더',
  sourceModel: 'LeaveYearBalance',

  thresholds: {
    triggerAfterDays: 0,     // immediate when conditions met
    repeatEveryDays: 7,      // weekly reminder
    maxNudges: 3,            // max 3 times (Nov → Dec)
  },

  triggerType: 'nudge_leave_yearend_burn',

  buildTitle(): string {
    return '📅 연차 소진 안내'
  },

  buildBody(item: OverdueItem): string {
    const remaining = item.meta?.remainingDays ?? 0
    const carryOverMax = item.meta?.carryOverMax ?? 0
    return `연차 잔여 ${remaining}일이 남아있습니다. 12월 31일까지 사용하지 않으면 이월 한도(${carryOverMax}일) 초과분은 소멸됩니다.`
  },

  getTitleKey(_item: OverdueItem): string {
    return 'notifications.nudge.leaveYearendBurn.title'
  },
  getBodyKey(_item: OverdueItem): string {
    return 'notifications.nudge.leaveYearendBurn.body'
  },
  getBodyParams(item: OverdueItem, _daysOverdue: number): Record<string, string | number> {
    return { remainingDays: String(item.meta?.remainingDays ?? 0), carryOverMax: String(item.meta?.carryOverMax ?? 0) }
  },

  async findOverdueItems(
    companyId: string,
    assigneeId: string,
    _cutoffDate: Date,
  ): Promise<OverdueItem[]> {
    // Only active during November 1 ~ December 25
    const now = new Date()
    const month = now.getMonth() // 0-indexed
    const day = now.getDate()

    if (month < 10) return [] // Before November
    if (month === 11 && day > 25) return [] // After December 25

    const year = now.getFullYear()

    // Get all leave balances for the assignee (LeaveYearBalance)
    const balances = await prisma.leaveYearBalance.findMany({
      where: {
        employeeId: assigneeId,
        year,
      },
      include: {
        leaveTypeDef: {
          select: { name: true, code: true, category: true },
        },
      },
    })

    const items: OverdueItem[] = []

    for (const b of balances) {
      // 연차(annual) 코드만 소진 유도 대상
      if (b.leaveTypeDef.code !== 'annual') continue

      const remaining = b.entitled + b.carriedOver + b.adjusted - b.used - b.pending

      if (remaining >= 3) {
        const carryOverMax = 0 // 이월 한도는 LeaveAccrualRule에서 조회 가능 (별도 확장)
        const wouldExpire = Math.max(remaining - carryOverMax, 0)

        if (wouldExpire > 0) {
          items.push({
            sourceId: b.id,
            sourceModel: 'LeaveYearBalance',
            recipientIds: [assigneeId],
            createdAt: new Date(year, 10, 1),
            displayTitle: `${b.leaveTypeDef.name ?? '연차'} 잔여 ${remaining}일 — 소멸 예상 ${wouldExpire}일`,
            actionUrl: '/leave/my',
            meta: {
              remainingDays: remaining,
              carryOverMax,
              wouldExpire,
              policyName: b.leaveTypeDef.name,
            },
          })
        }
      }
    }

    return items
  },
}
