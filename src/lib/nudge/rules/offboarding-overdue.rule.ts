// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Offboarding Task Overdue Nudge Rule
// src/lib/nudge/rules/offboarding-overdue.rule.ts
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: nudge rule — offboarding overdue
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════
//
// 조건: EmployeeOffboardingTask.status = PENDING
//       AND calculated dueDate (lastWorkingDate - dueDaysBefore) < now
//       AND EmployeeOffboarding.status = IN_PROGRESS
//
// 대상:
//   EMPLOYEE  → 퇴직 본인
//   MANAGER   → Position 계층 기반 매니저 조회 (getManagerByPosition)
//   HR/IT/FINANCE → skip (system actor — real employeeId 없음)
//
// 동적 임계값 (lastWorkingDate까지 남은 일수 기반):
//   D-14 이상   → trigger=1d after overdue, interval=2d, max=3
//   D-7~D-13   → trigger=0d (즉시), interval=1d, max=3
//   D-6 이하   → trigger=0d (즉시), interval=0.5d(12h), max=5
//
// Note: 오프보딩은 하드 데드라인(최종 근무일)이 있어 온보딩보다 aggressive
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type { NudgeRule, NudgeThresholds, OverdueItem } from '../types'
import { getManagerByPosition } from '@/lib/assignments'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

// ─── 동적 임계값: 최종 근무일까지 남은 일수 기반 ──────────

interface OffboardingThresholds extends NudgeThresholds {
  // NudgeThresholds의 repeatEveryDays가 0.5(12h)를 지원하지 않으므로
  // 여기서는 1로 맞추되 maxNudges를 5로 높여 효과 유사하게 처리
}

function getThresholdsForOffboarding(
  daysUntilLastWorking: number,
): OffboardingThresholds {
  if (daysUntilLastWorking >= 14) {
    // D-14 이상: 연체 후 1일 뒤 시작, 2일 간격, 최대 3회
    return { triggerAfterDays: 1, repeatEveryDays: 2, maxNudges: 3 }
  }
  if (daysUntilLastWorking >= 7) {
    // D-7 ~ D-13: 즉시, 1일 간격, 최대 3회
    return { triggerAfterDays: 0, repeatEveryDays: 1, maxNudges: 3 }
  }
  // D-6 이하: 즉시, 매일 (12h 지원 불가 → 1d로 대체), 최대 5회
  return { triggerAfterDays: 0, repeatEveryDays: 1, maxNudges: 5 }
}

// ─── Recipient Resolution ──────────────────────────────────
// EMPLOYEE + MANAGER 처리 (HR/IT/FINANCE: system actor → skip)

async function resolveOffboardingRecipient(
  assigneeType: string,
  employeeId:   string,
  assigneeId:   string,  // 현재 로그인 사용자
  positionId?:  string | null,
): Promise<string | null> {
  switch (assigneeType) {
    case 'EMPLOYEE':
      return employeeId === assigneeId ? employeeId : null

    case 'MANAGER':
      // Position 계층 기반 매니저 조회 (getManagerByPosition)
      if (!positionId) return null
      try {
        const mgrInfo = await getManagerByPosition(positionId)
        return mgrInfo?.managerId === assigneeId ? mgrInfo.managerId : null
      } catch {
        return null
      }

    case 'HR':
    case 'IT':
    case 'FINANCE':
    default:
      return null  // system actor: no real employeeId
  }
}

// ─── Rule 구현 ────────────────────────────────────────────

export const offboardingOverdueRule: NudgeRule = {
  ruleId:      'offboarding-task-overdue',
  description: '오프보딩 태스크 기한 초과 — 담당자에게 리마인더 (하드 데드라인 기반)',
  sourceModel: 'EmployeeOffboardingTask',

  // engine이 매일 평가하도록 최소 임계값 설정
  // 실제 thresholds는 findOverdueItems 내부에서 동적 결정
  thresholds: {
    triggerAfterDays: 0,
    repeatEveryDays:  1,
    maxNudges:        5,
  },

  triggerType: 'nudge:offboarding:overdue',

  buildTitle(item: OverdueItem): string {
    const daysLeft = item.meta?.daysUntilLastWorking as number | undefined
    const urgency  = daysLeft !== undefined && daysLeft <= 6 ? '🚨' : '⚠️'
    return `${urgency} 오프보딩 태스크 기한 초과`
  },

  buildBody(item: OverdueItem, daysOverdue: number): string {
    const daysLeft = item.meta?.daysUntilLastWorking as number | undefined
    const deadline = daysLeft !== undefined
      ? ` (최종 근무일까지 ${daysLeft}일 남음)`
      : ''
    return `"${item.displayTitle}" 태스크가 ${daysOverdue}일 초과됐습니다${deadline}. 즉시 처리해 주세요.`
  },

  async findOverdueItems(
    companyId:   string,
    assigneeId:  string,
    _cutoffDate: Date,   // 역방향 계산이므로 engine cutoffDate 무시
  ): Promise<OverdueItem[]> {
    const now = new Date()

    // ── 진행 중인 오프보딩의 PENDING 태스크 조회 ─────────
    // EMPLOYEE + MANAGER 태스크 모두 조회 후 resolveOffboardingRecipient로 판단
    const pendingTasks = await prisma.employeeOffboardingTask.findMany({
      where: {
        status: 'PENDING',
        employeeOffboarding: {
          status:   'IN_PROGRESS',
          employee: {
            assignments: {
              some: {
                companyId,
                isPrimary: true,
                endDate:   null,
              },
            },
          },
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
            dueDaysBefore: true,
            isRequired:   true,
          },
        },
        employeeOffboarding: {
          select: {
            id:              true,
            employeeId:      true,
            lastWorkingDate: true,
            resignType:      true,
            employee: {
              select: {
                id:   true,
                name: true,
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

    for (const et of pendingTasks) {
      const offboarding    = et.employeeOffboarding
      const task           = et.task
      const dueDaysBefore  = task.dueDaysBefore
      const lastWorkingDate = offboarding.lastWorkingDate

      // dueDate = lastWorkingDate - dueDaysBefore (역방향)
      const dueDate = new Date(
        lastWorkingDate.getTime() - dueDaysBefore * 86_400_000,
      )

      // 아직 기한이 안 지난 태스크 → skip
      if (dueDate >= now) continue

      // 최종 근무일까지 남은 일수 계산
      const daysUntilLastWorking = Math.ceil(
        (lastWorkingDate.getTime() - now.getTime()) / 86_400_000,
      )

      // 동적 임계값 적용
      const thresholds = getThresholdsForOffboarding(daysUntilLastWorking)
      const taskCutoff = new Date(
        dueDate.getTime() + thresholds.triggerAfterDays * 86_400_000,
      )
      if (now < taskCutoff) continue

      // Recipient 판별
      const positionId = (extractPrimaryAssignment(offboarding.employee.assignments ?? []) as Record<string, any>)?.positionId
      const recipientId = await resolveOffboardingRecipient(
        task.assigneeType,
        offboarding.employeeId,
        assigneeId,
        positionId,
      )
      if (!recipientId) continue

      const daysOverdue = Math.floor(
        (now.getTime() - dueDate.getTime()) / 86_400_000,
      )

      items.push({
        sourceId:     et.id,
        sourceModel:  'EmployeeOffboardingTask',
        recipientIds: [recipientId],
        createdAt:    dueDate,   // engine daysOverdue 계산 기준
        displayTitle: `${task.title} — ${offboarding.employee.name}`,
        actionUrl:    `/offboarding/${offboarding.id}`,
        meta: {
          taskTitle:           task.title,
          employeeName:        offboarding.employee.name,
          assigneeType:        task.assigneeType,
          dueDaysBefore,
          isRequired:          task.isRequired,
          lastWorkingDate:     lastWorkingDate.toISOString(),
          daysUntilLastWorking,
          daysOverdue,
          thresholds,
          resignType:          offboarding.resignType,
        },
      })
    }

    return items
  },
}
