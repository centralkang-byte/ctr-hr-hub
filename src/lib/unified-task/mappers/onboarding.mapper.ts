// ═══════════════════════════════════════════════════════════
// CTR HR Hub — EmployeeOnboardingTask → UnifiedTask Mapper
// src/lib/unified-task/mappers/onboarding.mapper.ts
// ═══════════════════════════════════════════════════════════

import type { Prisma } from '@/generated/prisma/client'
import {
  UnifiedTaskType,
  UnifiedTaskStatus,
  UnifiedTaskPriority,
  type UnifiedTask,
  type UnifiedTaskActor,
  type UnifiedTaskMapper,
} from '../types'

// ─── Prisma 조회 타입 ──────────────────────────────────────

export type OnboardingTaskWithRelations = Prisma.EmployeeOnboardingTaskGetPayload<{
  include: {
    task: {
      select: {
        id: true
        title: true
        assigneeType: true
        dueDaysAfter: true
        isRequired: true
        category: true
        sortOrder: true
      }
    }
    employeeOnboarding: {
      include: {
        employee: {
          select: {
            id: true
            name: true
            assignments: {
              where: { isPrimary: true; endDate: null }
              take: 1
              select: {
                managerId: true
                jobGrade: { select: { name: true } }
                department: { select: { name: true } }
              }
            }
          }
        }
        buddy: {
          select: { id: true; name: true }
        }
        manager: {
          select: { id: true; name: true }
        }
      }
    }
  }
}>

// ─── System Actors (HR/IT/FINANCE — 실제 employeeId 없음) ─

const SYSTEM_ACTORS: Record<string, UnifiedTaskActor> = {
  HR:      { employeeId: 'system:hr',      name: 'HR팀' },
  IT:      { employeeId: 'system:it',      name: 'IT팀' },
  FINANCE: { employeeId: 'system:finance', name: 'Finance팀' },
}

const UNASSIGNED_ACTOR: UnifiedTaskActor = {
  employeeId: 'unassigned',
  name: '미지정',
}

// ─── Status 매핑 ──────────────────────────────────────────

function mapOnboardingStatus(status: string): UnifiedTaskStatus {
  switch (status) {
    case 'PENDING':  return UnifiedTaskStatus.PENDING
    case 'DONE':     return UnifiedTaskStatus.COMPLETED
    case 'SKIPPED':  return UnifiedTaskStatus.CANCELLED
    default:         return UnifiedTaskStatus.PENDING
  }
}

// ─── Milestone 그룹 레이블 ────────────────────────────────
// dueDaysAfter 기반으로 Day 1 / Day 7 / Day 30 / Day 90 분류

function getMilestoneGroup(dueDaysAfter: number): string {
  if (dueDaysAfter <= 1)   return 'Day 1'
  if (dueDaysAfter <= 7)   return 'Day 7'
  if (dueDaysAfter <= 30)  return 'Day 30'
  if (dueDaysAfter <= 90)  return 'Day 90'
  return `Day ${dueDaysAfter}`
}

// ─── Priority 추론 ─────────────────────────────────────────
// dueDate 기준 연체 여부로 판단

function mapOnboardingPriority(
  status: string,
  dueDate: Date | null,
): UnifiedTaskPriority {
  if (status !== 'PENDING') return UnifiedTaskPriority.LOW

  if (!dueDate) return UnifiedTaskPriority.MEDIUM

  const now = Date.now()
  const dueTime = dueDate.getTime()
  const diffDays = (now - dueTime) / (1000 * 60 * 60 * 24)

  if (diffDays > 3)  return UnifiedTaskPriority.URGENT   // 3일 이상 연체
  if (diffDays > 0)  return UnifiedTaskPriority.HIGH     // 연체 (오늘 초과)
  if (diffDays > -2) return UnifiedTaskPriority.MEDIUM   // 2일 이내 마감
  return UnifiedTaskPriority.LOW
}

// ─── Assignee Resolve ──────────────────────────────────────

function resolveAssignee(
  assigneeType: string,
  onboarding: OnboardingTaskWithRelations['employeeOnboarding'],
): UnifiedTaskActor {
  const employee = onboarding.employee

  switch (assigneeType) {
    case 'EMPLOYEE':
      return {
        employeeId: employee.id,
        name:       employee.name,
        position:   employee.assignments?.[0]?.jobGrade?.name,
        department: employee.assignments?.[0]?.department?.name,
      }

    case 'MANAGER': {
      const managerId = employee.assignments?.[0]?.managerId
      if (!managerId) return UNASSIGNED_ACTOR
      // manager relation은 include에서 직접 포함하지 않고
      // managerId만 반환 (route에서 별도 조회 or actor 구성)
      return {
        employeeId: managerId,
        name:       '매니저',   // route에서 실명 보강 가능 (현재 best-effort)
      }
    }

    case 'BUDDY':
      if (!onboarding.buddy) return UNASSIGNED_ACTOR
      return {
        employeeId: onboarding.buddy.id,
        name:       onboarding.buddy.name,
      }

    case 'HR':
    case 'IT':
    case 'FINANCE':
      return SYSTEM_ACTORS[assigneeType] ?? UNASSIGNED_ACTOR

    default:
      return UNASSIGNED_ACTOR
  }
}

// ─── Mapper 구현 ───────────────────────────────────────────

class OnboardingTaskMapper
  implements UnifiedTaskMapper<OnboardingTaskWithRelations>
{
  readonly type = UnifiedTaskType.ONBOARDING_TASK

  toUnifiedTask(source: OnboardingTaskWithRelations): UnifiedTask {
    const onboarding    = source.employeeOnboarding
    const task          = source.task
    const employee      = onboarding.employee
    const dueDaysAfter  = task.dueDaysAfter
    const milestoneGroup = getMilestoneGroup(dueDaysAfter)

    // dueDate = 온보딩 시작일 + dueDaysAfter
    const startedAt = onboarding.startedAt
    const dueDate   = startedAt
      ? new Date(startedAt.getTime() + dueDaysAfter * 86_400_000)
      : null

    const assignee  = resolveAssignee(task.assigneeType, onboarding)
    const status    = mapOnboardingStatus(source.status)
    const priority  = mapOnboardingPriority(source.status, dueDate)
    const companyId = onboarding.companyId ?? ''

    return {
      id:       `EmployeeOnboardingTask:${source.id}`,
      type:     UnifiedTaskType.ONBOARDING_TASK,
      status,
      priority,

      title:   `${task.title} — ${employee.name} (${milestoneGroup})`,
      summary: `카테고리: ${task.category} · 담당: ${task.assigneeType}`,

      requester: {
        employeeId: employee.id,
        name:       employee.name,
        position:   employee.assignments?.[0]?.jobGrade?.name,
        department: employee.assignments?.[0]?.department?.name,
      },
      assignee,

      createdAt: onboarding.createdAt.toISOString(),
      updatedAt: source.completedAt?.toISOString() ?? onboarding.createdAt.toISOString(),
      dueDate:   dueDate?.toISOString(),

      sourceId:    source.id,
      sourceModel: 'EmployeeOnboardingTask',
      actionUrl:   `/onboarding/${onboarding.id}/tasks/${source.id}`,

      companyId,

      metadata: {
        category:        task.category,
        assigneeType:    task.assigneeType,
        dueDaysAfter,
        milestoneGroup,
        isRequired:      task.isRequired,
        sortOrder:       task.sortOrder,
        onboardingId:    onboarding.id,
        onboardingStatus: onboarding.status,
        buddyId:         onboarding.buddyId ?? null,
        daysOverdue:     dueDate
          ? Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / 86_400_000))
          : null,
      },
    }
  }

  toUnifiedTasks(sources: OnboardingTaskWithRelations[]): UnifiedTask[] {
    return sources.map((s) => this.toUnifiedTask(s))
  }
}

export const onboardingTaskMapper = new OnboardingTaskMapper()
