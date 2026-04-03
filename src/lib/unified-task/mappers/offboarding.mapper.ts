// ═══════════════════════════════════════════════════════════
// CTR HR Hub — EmployeeOffboardingTask → UnifiedTask Mapper
// src/lib/unified-task/mappers/offboarding.mapper.ts
// ═══════════════════════════════════════════════════════════
//
// Onboarding 매퍼와 구조적으로 동일하지만 핵심 차이:
//   - dueDate 계산: lastWorkingDate - dueDaysBefore (역방향)
//   - Priority: lastWorkingDate까지 남은 일수 기준
//   - Title: "[Offboarding] {taskTitle}"
//   - assigneeType: EMPLOYEE/MANAGER/HR/IT/FINANCE
//   - MANAGER → UNASSIGNED (sync mapper 제약, nudge rule에서 정상 라우팅)
// ═══════════════════════════════════════════════════════════

import type { Prisma } from '@/generated/prisma/client'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import {
  UnifiedTaskType,
  UnifiedTaskStatus,
  UnifiedTaskPriority,
  type UnifiedTask,
  type UnifiedTaskActor,
  type UnifiedTaskMapper,
} from '../types'

// ─── Prisma 조회 타입 ──────────────────────────────────────

export type OffboardingTaskWithRelations = Prisma.EmployeeOffboardingTaskGetPayload<{
  include: {
    task: {
      select: {
        id: true
        title: true
        description: true
        assigneeType: true
        dueDaysBefore: true
        isRequired: true
        sortOrder: true
      }
    }
    employeeOffboarding: {
      include: {
        employee: {
          select: {
            id: true
            name: true
            assignments: {
              where: { isPrimary: true; endDate: null }
              take: 1
              select: {
                companyId: true
                jobGrade: { select: { name: true } }
                department: { select: { name: true } }
              }
            }
          }
        }
      }
    }
  }
}>

// ─── System Actors (HR/IT/FINANCE — 실제 employeeId 없음) ─

const SYSTEM_ACTORS: Record<string, UnifiedTaskActor> = {
  HR: { employeeId: 'system:hr', name: 'HR팀' },
  IT: { employeeId: 'system:it', name: 'IT팀' },
  FINANCE: { employeeId: 'system:finance', name: 'Finance팀' },
}

const UNASSIGNED_ACTOR: UnifiedTaskActor = {
  employeeId: 'unassigned',
  name: '미지정',
}

// ─── Status 매핑 ──────────────────────────────────────────
// TaskProgressStatus: PENDING / IN_PROGRESS / DONE / BLOCKED / SKIPPED

function mapOffboardingStatus(status: string): UnifiedTaskStatus {
  switch (status) {
    case 'PENDING': return UnifiedTaskStatus.PENDING
    case 'IN_PROGRESS': return UnifiedTaskStatus.IN_PROGRESS
    case 'BLOCKED': return UnifiedTaskStatus.PENDING  // BLOCKED → PENDING (+ metadata에 blocked 표시)
    case 'DONE': return UnifiedTaskStatus.COMPLETED
    case 'SKIPPED': return UnifiedTaskStatus.CANCELLED
    default: return UnifiedTaskStatus.PENDING
  }
}

// ─── Priority 추론 ─────────────────────────────────────────
// Offboarding: lastWorkingDate까지 남은 일수 기반 (역방향)
//   - 이미 overdue (due date 지남) → URGENT
//   - due today → HIGH
//   - 3일 이내 → MEDIUM
//   - 그 외 → LOW

function mapOffboardingPriority(
  status: string,
  dueDate: Date | null,
): UnifiedTaskPriority {
  if (status !== 'PENDING' && status !== 'IN_PROGRESS' && status !== 'BLOCKED') return UnifiedTaskPriority.LOW
  if (!dueDate) return UnifiedTaskPriority.MEDIUM

  const now = Date.now()
  const dueTime = dueDate.getTime()
  const diffDays = (dueTime - now) / 86_400_000   // 양수 = 아직 남음, 음수 = 지남

  if (diffDays < 0) return UnifiedTaskPriority.URGENT  // 이미 overdue
  if (diffDays < 1) return UnifiedTaskPriority.HIGH    // today
  if (diffDays <= 3) return UnifiedTaskPriority.MEDIUM  // 3일 이내
  return UnifiedTaskPriority.LOW
}

// ─── Assignee Resolve ──────────────────────────────────────
// OffboardingAssignee: EMPLOYEE / MANAGER / HR / IT / FINANCE

function resolveOffboardingAssignee(
  assigneeType: string,
  offboarding: OffboardingTaskWithRelations['employeeOffboarding'],
): UnifiedTaskActor {
  const employee = offboarding.employee

  switch (assigneeType) {
    case 'EMPLOYEE':
      return {
        employeeId: employee.id,
        name: employee.name,
        position: extractPrimaryAssignment(employee.assignments ?? [])?.jobGrade?.name,
        department: extractPrimaryAssignment(employee.assignments ?? [])?.department?.name,
      }

    case 'MANAGER':
      // Mapper는 동기(sync) 인터페이스 — Position hierarchy DB 조회 불가.
      // 매니저 알림은 nudge rule에서 getManagerByPosition()으로 정상 라우팅됨.
      return UNASSIGNED_ACTOR

    case 'HR':
    case 'IT':
    case 'FINANCE':
      return SYSTEM_ACTORS[assigneeType] ?? UNASSIGNED_ACTOR

    default:
      return UNASSIGNED_ACTOR
  }
}

// ─── Mapper 구현 ───────────────────────────────────────────

class OffboardingTaskMapper
  implements UnifiedTaskMapper<OffboardingTaskWithRelations> {
  readonly type = UnifiedTaskType.OFFBOARDING_TASK

  toUnifiedTask(source: OffboardingTaskWithRelations): UnifiedTask {
    const offboarding = source.employeeOffboarding
    const task = source.task
    const employee = offboarding.employee
    const dueDaysBefore = task.dueDaysBefore

    // dueDate = lastWorkingDate - dueDaysBefore (역방향 계산)
    const lastWorkingDate = offboarding.lastWorkingDate
    const dueDate = lastWorkingDate
      ? new Date(lastWorkingDate.getTime() - dueDaysBefore * 86_400_000)
      : null

    const assignee = resolveOffboardingAssignee(task.assigneeType, offboarding)
    const status = mapOffboardingStatus(source.status)
    const priority = mapOffboardingPriority(source.status, dueDate)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const companyId = (extractPrimaryAssignment(employee.assignments ?? []) as any)?.companyId ?? ''
    const isBlocked = source.status === 'BLOCKED'

    // 남은 일수 계산 (마감 기준)
    const daysUntilDue = dueDate
      ? Math.ceil((dueDate.getTime() - Date.now()) / 86_400_000)
      : null

    return {
      id: `offboarding_task:${source.id}`,
      type: UnifiedTaskType.OFFBOARDING_TASK,
      status,
      priority,

      title: `[Offboarding] ${task.title}`,
      summary: task.description ?? `담당: ${task.assigneeType} · ${daysUntilDue !== null
        ? daysUntilDue < 0
          ? `${Math.abs(daysUntilDue)}일 초과`
          : `${daysUntilDue}일 후 마감`
        : '기한 없음'
        }`,

      requester: {
        employeeId: employee.id,
        name: employee.name,
        position: extractPrimaryAssignment(employee.assignments ?? [])?.jobGrade?.name,
        department: extractPrimaryAssignment(employee.assignments ?? [])?.department?.name,
      },
      assignee,

      createdAt: offboarding.startedAt.toISOString(),
      updatedAt: source.completedAt?.toISOString() ?? offboarding.startedAt.toISOString(),
      dueDate: dueDate?.toISOString(),

      sourceId: source.id,
      sourceModel: 'EmployeeOffboardingTask',
      actionUrl: `/offboarding/${offboarding.id}`,

      companyId,

      metadata: {
        assigneeType: task.assigneeType,
        dueDaysBefore,
        isRequired: task.isRequired,
        isBlocked,
        sortOrder: task.sortOrder,
        offboardingId: offboarding.id,
        offboardingStatus: offboarding.status,
        resignType: offboarding.resignType,
        lastWorkingDate: offboarding.lastWorkingDate.toISOString(),
        handoverToId: offboarding.handoverToId ?? null,
        daysUntilDue,
        completedById: source.completedById ?? null,
      },
    }
  }

  toUnifiedTasks(sources: OffboardingTaskWithRelations[]): UnifiedTask[] {
    return sources
      .map((s) => {
        try {
          if (!s.employeeOffboarding?.employee) {
            console.warn(`[offboarding.mapper] Orphaned OffboardingTask: ${s.id} — skipping`)
            return null
          }
          return this.toUnifiedTask(s)
        } catch (error) {
          console.error(`[offboarding.mapper] Error mapping OffboardingTask ${s.id}:`, error)
          return null
        }
      })
      .filter((t): t is UnifiedTask => t !== null)
  }
}

export const offboardingTaskMapper = new OffboardingTaskMapper()

// ─── Prisma Include 상수 (route.ts에서 재사용) ──────────────

export const OFFBOARDING_TASK_INCLUDE = {
  task: {
    select: {
      id: true,
      title: true,
      description: true,
      assigneeType: true,
      dueDaysBefore: true,
      isRequired: true,
      sortOrder: true,
    },
  },
  employeeOffboarding: {
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          assignments: {
            where: { isPrimary: true, endDate: null },
            take: 1,
            select: {
              companyId: true,
              jobGrade: { select: { name: true } },
              department: { select: { name: true } },
            },
          },
        },
      },
    },
  },
} as const
