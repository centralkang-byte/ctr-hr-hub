// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Onboarding Task Overdue Nudge Rule
// src/lib/nudge/rules/onboarding-overdue.rule.ts
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: nudge rule — onboarding overdue
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════
//
// 조건: EmployeeOnboardingTask.status = PENDING
//       AND calculated dueDate (startedAt + dueDaysAfter) < now
//       AND EmployeeOnboarding.status IN [NOT_STARTED, IN_PROGRESS]
//
// 대상:
//   EMPLOYEE  → 신입 본인
//   BUDDY     → onboarding.buddyId
//   MANAGER   → TODO: Position 계층 미구현 → 현재 skip
//   HR/IT/FINANCE → skip (system actor — real employeeId 없음)
//
// 동적 임계값 (dueDaysAfter 기반):
//   Day 0-1  → trigger=1d, repeat=1d, max=2
//   Day 2-7  → trigger=1d, repeat=2d, max=3
//   Day 8+   → trigger=3d, repeat=3d, max=3
//
// 주의: NudgeEngine이 전달하는 cutoffDate는 이 룰에서 사용하지 않음.
//       dueDate = startedAt + dueDaysAfter 계산으로 자체 판단.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type { NudgeRule, NudgeThresholds, OverdueItem } from '../types'
// FIX: Issue #4 — Import getManagerByPosition to resolve MANAGER assignee
import { getManagerByPosition } from '@/lib/assignments'

// ─── 동적 임계값 선택 ──────────────────────────────────────

function getThresholdsForTask(dueDaysAfter: number): NudgeThresholds {
  if (dueDaysAfter <= 1) {
    return { triggerAfterDays: 1, repeatEveryDays: 1, maxNudges: 2 }
  }
  if (dueDaysAfter <= 7) {
    return { triggerAfterDays: 1, repeatEveryDays: 2, maxNudges: 3 }
  }
  return { triggerAfterDays: 3, repeatEveryDays: 3, maxNudges: 3 }
}

// ─── Assignee Resolve ──────────────────────────────────────
// NOTE: MANAGER는 Position 계층 구조(미구현)가 필요하므로 현재 skip.
//       HR/IT/FINANCE는 система actor → skip.

// FIX: Issue #4 — resolveRecipientId is now async to support MANAGER lookup
//   via Position hierarchy (getManagerByPosition).
async function resolveRecipientId(
  assigneeType: string,
  employeeId:   string,
  buddyId:      string | null,
  assigneeUserId: string,
  positionId?:  string | null,
): Promise<string | null> {
  switch (assigneeType) {
    case 'EMPLOYEE':
      return employeeId === assigneeUserId ? employeeId : null

    case 'BUDDY':
      return buddyId === assigneeUserId ? buddyId : null

    case 'MANAGER':
      // FIX: Issue #4 — Resolve manager via Position hierarchy.
      //   Previously: returned null (silently skipped MANAGER tasks).
      //   Now: looks up reporting line via reportsToPositionId.
      if (!positionId) return null
      try {
        const mgrInfo = await getManagerByPosition(positionId)
        return mgrInfo?.managerId === assigneeUserId ? mgrInfo.managerId : null
      } catch {
        return null
      }

    // HR / IT / FINANCE: system actor — real employeeId 없음
    case 'HR':
    case 'IT':
    case 'FINANCE':
    default:
      return null
  }
}

// ─── Milestone 그룹 레이블 ────────────────────────────────

function getMilestoneGroup(dueDaysAfter: number): string {
  if (dueDaysAfter <= 1)  return 'Day 1'
  if (dueDaysAfter <= 7)  return 'Day 7'
  if (dueDaysAfter <= 30) return 'Day 30'
  if (dueDaysAfter <= 90) return 'Day 90'
  return `Day ${dueDaysAfter}`
}

// ─── Rule 구현 ────────────────────────────────────────────

export const onboardingOverdueRule: NudgeRule = {
  ruleId:      'onboarding-task-overdue',
  description: '온보딩 태스크 기한 초과 — 담당자에게 리마인더',
  sourceModel: 'EmployeeOnboardingTask',

  // NudgeEngine이 cutoffDate를 계산하는 데 사용하는 기본값.
  // 이 룰은 내부에서 dueDate를 직접 계산하므로 engine cutoffDate는 무시됨.
  // 가장 촉박한 Day 1 임계값(1일)을 사용해 engine이 매일 평가하도록 유도.
  thresholds: {
    triggerAfterDays: 1,
    repeatEveryDays:  1,
    maxNudges:        3,
  },

  triggerType: 'nudge_onboarding_task_overdue',

  buildTitle(item: OverdueItem): string {
    const milestone = (item.meta?.milestoneGroup as string) ?? ''
    return `⚠️ 온보딩 태스크 기한 초과 (${milestone})`
  },

  buildBody(item: OverdueItem, daysOverdue: number): string {
    return `"${item.displayTitle}" 태스크가 ${daysOverdue}일 초과됐습니다. 빠른 완료가 필요합니다.`
  },

  async findOverdueItems(
    companyId:   string,
    assigneeId:  string,
    _cutoffDate: Date,   // 이 룰에서는 사용 안 함 — dueDate 직접 계산
  ): Promise<OverdueItem[]> {
    const now = new Date()

    // ── 진행 중인 온보딩의 PENDING 태스크 조회 ──────────────
    // 로그인 사용자가 신규 입사자 본인 또는 버디인 경우만 처리
    const overdueTasks = await prisma.employeeOnboardingTask.findMany({
      where: {
        status: 'PENDING',
        employeeOnboarding: {
          companyId,
          status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
          // FIX: Issue #4 — Include MANAGER tasks by broader query.
          //   MANAGER tasks are filtered by resolveRecipientId below.
          OR: [
            { employeeId: assigneeId },   // 신규 입사자 본인
            { buddyId:    assigneeId },   // 버디 담당
            // MANAGER 건: 어관리는 onboarding 위단 조회 후 resolveRecipientId로 판단
          ],
        },
      },
      select: {
        id:          true,
        completedAt: true,
        task: {
          select: {
            id:           true,
            title:        true,
            assigneeType: true,
            dueDaysAfter: true,
          },
        },
        employeeOnboarding: {
          select: {
            id:         true,
            employeeId: true,
            buddyId:    true,
            startedAt:  true,
            employee: {
              select: {
                id:   true,
                name: true,
                // FIX: Issue #4 — Fetch positionId for MANAGER resolution
                assignments: {
                  where:  { isPrimary: true, endDate: null },
                  select: { positionId: true },
                  take:   1,
                },
              },
            },
          },
        },
      },
      take: 100,
    })

    const items: OverdueItem[] = []

    for (const et of overdueTasks) {
      const onboarding   = et.employeeOnboarding
      const task         = et.task
      const dueDaysAfter = task.dueDaysAfter
      const startedAt    = onboarding.startedAt

      // startedAt이 없으면 dueDate 계산 불가 → skip
      if (!startedAt) continue

      const dueDate = new Date(startedAt.getTime() + dueDaysAfter * 86_400_000)

      // 아직 기한이 안 지난 태스크 → skip
      if (dueDate >= now) continue

      // 동적 임계값 적용: triggerAfterDays 경과했는지 확인
      const taskThresholds = getThresholdsForTask(dueDaysAfter)
      const taskCutoff     = new Date(
        dueDate.getTime() + taskThresholds.triggerAfterDays * 86_400_000,
      )
      if (now < taskCutoff) continue

      // FIX: Issue #4 — await async resolveRecipientId, pass positionId for MANAGER
      const positionId = onboarding.employee.assignments?.[0]?.positionId
      const recipientId = await resolveRecipientId(
        task.assigneeType,
        onboarding.employeeId,
        onboarding.buddyId,
        assigneeId,
        positionId,
      )
      if (!recipientId) continue

      const milestoneGroup = getMilestoneGroup(dueDaysAfter)
      const daysOverdue    = Math.floor(
        (now.getTime() - dueDate.getTime()) / 86_400_000,
      )

      items.push({
        sourceId:     et.id,
        sourceModel:  'EmployeeOnboardingTask',
        recipientIds: [recipientId],
        createdAt:    dueDate,   // engine daysOverdue 계산 기준
        displayTitle: `${task.title} — ${onboarding.employee.name}`,
        actionUrl:    `/onboarding/${onboarding.id}/tasks/${et.id}`,
        meta: {
          taskTitle:       task.title,
          employeeName:    onboarding.employee.name,
          assigneeType:    task.assigneeType,
          dueDaysAfter,
          milestoneGroup,
          daysOverdue,
          taskThresholds,
        },
      })
    }

    return items
  },
}
