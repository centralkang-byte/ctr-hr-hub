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
  sourceModel: 'EmployeeLeaveBalance',

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

    // Get all leave balances for the assignee
    const balances = await prisma.employeeLeaveBalance.findMany({
      where: {
        employeeId: assigneeId,
        year,
      },
      include: {
        policy: {
          select: {
            name: true,
            carryOverAllowed: true,
            maxCarryOverDays: true,
          },
        },
      },
    })

    const items: OverdueItem[] = []

    for (const b of balances) {
      const remaining =
        Number(b.grantedDays) +
        Number(b.carryOverDays) -
        Number(b.usedDays) -
        Number(b.pendingDays)

      if (remaining >= 3) {
        const carryOverMax = b.policy?.carryOverAllowed
          ? Number(b.policy.maxCarryOverDays ?? 0)
          : 0
        const wouldExpire = Math.max(remaining - carryOverMax, 0)

        if (wouldExpire > 0) {
          items.push({
            sourceId: b.id,
            sourceModel: 'EmployeeLeaveBalance',
            recipientIds: [assigneeId],
            createdAt: new Date(year, 10, 1), // November 1 as reference date
            displayTitle: `${b.policy?.name ?? '연차'} 잔여 ${remaining}일 — 소멸 예상 ${wouldExpire}일`,
            actionUrl: '/leave/my',
            meta: {
              remainingDays: remaining,
              carryOverMax,
              wouldExpire,
              policyName: b.policy?.name,
            },
          })
        }
      }
    }

    return items
  },
}
