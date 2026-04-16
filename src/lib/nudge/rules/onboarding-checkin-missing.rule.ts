// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Onboarding Check-in Missing Nudge Rule
// src/lib/nudge/rules/onboarding-checkin-missing.rule.ts
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: nudge rule — onboarding checkin missing
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════
//
// 조건: EmployeeOnboarding.status IN [NOT_STARTED, IN_PROGRESS]
//       AND 예상 체크인 주차가 지났는데 OnboardingCheckin 미존재
//
// 체크인 마일스톤:
//   week 1  = startedAt + 7d   (Day 7)
//   week 4  = startedAt + 30d  (Day 30)
//   week 13 = startedAt + 90d  (Day 90)
//
// 대상: 신입 본인 (employeeId)
// 임계값: triggerAfterDays=2, repeatEveryDays=3, maxNudges=2
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type { NudgeRule, OverdueItem } from '../types'

// ─── 체크인 마일스톤 정의 ─────────────────────────────────

const CHECKIN_MILESTONES = [
  { expectedDay: 7,  checkinWeek: 1  },
  { expectedDay: 30, checkinWeek: 4  },
  { expectedDay: 90, checkinWeek: 13 },
] as const

// ─── Rule 구현 ────────────────────────────────────────────

export const onboardingCheckinMissingRule: NudgeRule = {
  ruleId:      'onboarding-checkin-missing',
  description: '온보딩 체크인(감정 펄스) 누락 — 신입에게 리마인더',
  sourceModel: 'EmployeeOnboarding',

  thresholds: {
    triggerAfterDays: 2,   // 마일스톤 경과 후 2일 뒤부터 nudge
    repeatEveryDays:  3,   // 3일마다 반복
    maxNudges:        2,   // 최대 2회
  },

  triggerType: 'nudge_onboarding_checkin_missing',

  buildTitle(item: OverdueItem): string {
    const week = (item.meta?.checkinWeek as number) ?? ''
    return `💬 온보딩 체크인을 해주세요 (${week}주차)`
  },

  buildBody(item: OverdueItem, daysOverdue: number): string {
    return `${item.displayTitle} — ${daysOverdue}일 전에 예정된 체크인이 아직 완료되지 않았습니다. 감정 펄스를 기록해 주세요.`
  },

  getTitleKey(_item: OverdueItem): string {
    return 'notifications.nudge.onboardingCheckin.title'
  },
  getBodyKey(_item: OverdueItem): string {
    return 'notifications.nudge.onboardingCheckin.body'
  },
  getBodyParams(item: OverdueItem, daysOverdue: number): Record<string, string | number> {
    return { displayTitle: item.displayTitle, daysOverdue, week: String(item.meta?.week ?? '') }
  },

  async findOverdueItems(
    companyId:  string,
    assigneeId: string,
    _cutoffDate: Date,   // 내부에서 마일스톤 기반 직접 계산
  ): Promise<OverdueItem[]> {
    const now = new Date()

    // ── 진행 중인 온보딩 (본인) 조회 ─────────────────────
    const onboardings = await prisma.employeeOnboarding.findMany({
      where: {
        employeeId: assigneeId,
        companyId,
        status:     { in: ['NOT_STARTED', 'IN_PROGRESS'] },
        startedAt:  { not: null },
      },
      select: {
        id:         true,
        employeeId: true,
        startedAt:  true,
        employee: {
          select: { id: true, name: true },
        },
      },
      take: 10,
    })

    if (onboardings.length === 0) return []

    // ── 이미 제출된 체크인 주차 조회 ──────────────────────
    // 별도 쿼리로 OnboardingCheckin 조회 (employee relation 중복 방지)
    const submittedCheckins = await prisma.onboardingCheckin.findMany({
      where: {
        employeeId: assigneeId,
        companyId,
      },
      select: { checkinWeek: true },
    })

    const submittedWeeks = new Set(submittedCheckins.map((c) => c.checkinWeek))

    const items: OverdueItem[] = []

    for (const ob of onboardings) {
      const startedAt = ob.startedAt
      if (!startedAt) continue

      for (const milestone of CHECKIN_MILESTONES) {
        const expectedDate = new Date(
          startedAt.getTime() + milestone.expectedDay * 86_400_000,
        )

        // 마일스톤이 아직 안 됐으면 skip
        if (expectedDate > now) continue

        // 이미 체크인 완료했으면 skip
        if (submittedWeeks.has(milestone.checkinWeek)) continue

        // triggerAfterDays: 마일스톤 + 2일 후부터 nudge
        const nudgeStartDate = new Date(
          expectedDate.getTime() + this.thresholds.triggerAfterDays * 86_400_000,
        )
        if (now < nudgeStartDate) continue

        const daysOverdue = Math.floor(
          (now.getTime() - expectedDate.getTime()) / 86_400_000,
        )

        // sourceId = `${onboardingId}:week${checkinWeek}` (마일스톤별 유일성)
        const sourceId = `${ob.id}:week${milestone.checkinWeek}`

        items.push({
          sourceId,
          sourceModel:  'EmployeeOnboarding',
          recipientIds: [ob.employeeId],
          createdAt:    expectedDate,   // engine daysOverdue 계산 기준
          displayTitle: `${ob.employee.name} — ${milestone.checkinWeek}주차 체크인`,
          actionUrl:    '/onboarding/me',
          meta: {
            onboardingId:  ob.id,
            employeeName:  ob.employee.name,
            checkinWeek:   milestone.checkinWeek,
            expectedDay:   milestone.expectedDay,
            expectedDate:  expectedDate.toISOString().slice(0, 10),
            daysOverdue,
          },
        })
      }
    }

    return items
  },
}
