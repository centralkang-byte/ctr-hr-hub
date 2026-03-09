// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Performance Goal Overdue Nudge Rule
// src/lib/nudge/rules/performance-goal-overdue.rule.ts
// ═══════════════════════════════════════════════════════════
//
// 조건:
//   - PerformanceCycle.status = ACTIVE
//   - goalEnd 가 임박했거나 지났음
//   - 로그인 사용자 (assigneeId) 에게 PENDING_APPROVAL/APPROVED 목표 없음
//     (= 아직 미제출)
//
// goalEnd 기준 임계값:
//   D-7 이상 전 ~ goalEnd↓  →  trigger=7d ahead, interval=3d, max=2
//   D-3 이상 전 ~ goalEnd↓  →  trigger=3d ahead, interval=1d, max=3
//   goalEnd 초과            →  trigger=0d, interval=1d, max=5
//   goalEnd 초과 2일 이상   →  매니저에게도 보조 nudge
//
// triggerType: 'nudge:performance:goal-overdue'
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { getManagerByPosition } from '@/lib/assignments'
import { sendNotification } from '@/lib/notifications'
import type { NudgeRule, NudgeThresholds, OverdueItem } from '../types'

// ─── 임계값 ───────────────────────────────────────────────

function getGoalThresholds(daysUntilDeadline: number): NudgeThresholds {
  if (daysUntilDeadline <= 0) {
    // goalEnd 초과: 즉시, 매일, 최대 5회
    return { triggerAfterDays: 0, repeatEveryDays: 1, maxNudges: 5 }
  }
  if (daysUntilDeadline <= 3) {
    // D-3 이하: trigger=3일 전부터, 1일 간격, 최대 3회
    return { triggerAfterDays: 0, repeatEveryDays: 1, maxNudges: 3 }
  }
  // D-7 이하: trigger=7일 전부터, 3일 간격, 최대 2회
  return { triggerAfterDays: 0, repeatEveryDays: 3, maxNudges: 2 }
}

// ─── Rule ─────────────────────────────────────────────────

export const performanceGoalOverdueRule: NudgeRule = {
  ruleId:      'performance-goal-overdue',
  description: 'MBO 목표 미제출 직원 — goalEnd 임박/초과 시 리마인더',
  sourceModel: 'PerformanceCycle',

  // 엔진 최소 설정 (실제 임계값은 findOverdueItems 내부에서 동적 결정)
  thresholds: {
    triggerAfterDays: 0,
    repeatEveryDays:  1,
    maxNudges:        5,
  },

  triggerType: 'nudge:performance:goal-overdue',

  buildTitle(_item: OverdueItem): string {
    return '📋 MBO 목표를 제출해 주세요'
  },

  buildBody(item: OverdueItem, daysOverdue: number): string {
    const cycleName = item.meta?.cycleName as string | undefined
    const daysLeft  = item.meta?.daysUntilDeadline as number | undefined

    if (daysLeft !== undefined && daysLeft > 0) {
      return `${cycleName ?? '성과 주기'}의 목표 제출 마감이 ${daysLeft}일 남았습니다. MBO 목표를 등록하고 제출해 주세요.`
    }
    return `${cycleName ?? '성과 주기'}의 MBO 목표 제출 기한이 ${Math.abs(daysOverdue)}일 초과됐습니다. 즉시 처리해 주세요.`
  },

  async findOverdueItems(
    companyId:   string,
    assigneeId:  string,
    _cutoffDate: Date,
  ): Promise<OverdueItem[]> {
    const now = new Date()

    // ── 1. 활성 사이클 조회 ──────────────────────────────
    const cycle = await prisma.performanceCycle.findFirst({
      where: { companyId, status: 'ACTIVE' },
    })

    if (!cycle?.goalEnd) return []

    const goalEnd          = cycle.goalEnd
    const daysUntilDeadline = Math.ceil(
      (goalEnd.getTime() - now.getTime()) / 86_400_000,
    )

    // D-7보다 더 남은 경우 → nudge 불필요
    if (daysUntilDeadline > 7) return []

    // ── 2. 로그인 사용자의 제출 여부 확인 ────────────────
    const submittedGoal = await prisma.mboGoal.findFirst({
      where: {
        cycleId:    cycle.id,
        companyId,
        employeeId: assigneeId,
        status:     { in: ['PENDING_APPROVAL', 'APPROVED'] },
      },
      select: { id: true },
    })

    // 이미 제출했으면 nudge 불필요
    if (submittedGoal) return []

    // ── 3. 임계값 체크 ───────────────────────────────────
    const thresholds = getGoalThresholds(daysUntilDeadline)

    // goalEnd 전(D-7~D-1): goalEnd - (days remaining) 기준 trigger
    // goalEnd 후: overdue 일수 기준
    const daysOverdue    = Math.max(0, -daysUntilDeadline)
    const daysFromStart  = daysUntilDeadline <= 0 ? daysOverdue : (7 - daysUntilDeadline)

    if (daysFromStart < thresholds.triggerAfterDays) return []

    const items: OverdueItem[] = []

    // ── 4. 직원 본인 nudge ───────────────────────────────
    // sourceId: 유일하게 triggerType dedup을 위해 employee+cycle 복합키
    items.push({
      sourceId:     `${assigneeId}:${cycle.id}`,
      sourceModel:  'PerformanceCycle',
      recipientIds: [assigneeId],
      createdAt:    daysUntilDeadline <= 0 ? goalEnd : new Date(goalEnd.getTime() - 7 * 86_400_000),
      displayTitle: `${cycle.name} MBO 목표 미제출`,
      actionUrl:    '/performance/goals',
      meta: {
        cycleName:       cycle.name,
        cycleId:         cycle.id,
        goalEnd:         goalEnd.toISOString(),
        daysUntilDeadline,
        daysOverdue,
        thresholds,
      },
    })

    // ── 5. 보조 nudge: goalEnd 초과 2일+ → 매니저에게도 ─
    if (daysOverdue >= 2) {
      try {
        const assignment = await prisma.employeeAssignment.findFirst({
          where:  { employeeId: assigneeId, isPrimary: true, endDate: null },
          select: { positionId: true },
        })

        const employeeName = (await prisma.employee.findUnique({
          where:  { id: assigneeId },
          select: { name: true },
        }))?.name ?? '직원'

        if (assignment?.positionId) {
          const mgrInfo = await getManagerByPosition(assignment.positionId)

          if (mgrInfo?.managerId) {
            // 매니저 nudge는 별도 triggerType으로 dedup
            void sendNotification({
              employeeId:  mgrInfo.managerId,
              triggerType: `nudge:performance:goal-overdue:mgr:${assigneeId}:${cycle.id}`,
              title:       `⚠️ 팀원 MBO 목표 미제출 — ${daysOverdue}일 초과`,
              body:        `${employeeName}님이 ${cycle.name} MBO 목표를 아직 제출하지 않았습니다.`,
              link:        '/performance/team-goals',
              priority:    'high',
              companyId,
              metadata:    { cycleId: cycle.id, employeeId: assigneeId },
            })
          }
        }
      } catch (err) {
        console.warn('[performanceGoalOverdueRule] Manager nudge failed:', err)
      }
    }

    return items
  },
}
