// ═══════════════════════════════════════════════════════════
// CTR HR Hub — LeaveRequest → UnifiedTask Mapper
// src/lib/unified-task/mappers/leave.mapper.ts
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

// ─── Prisma 조회 타입 (include 포함) ──────────────────────

export type LeaveRequestWithRelations = Prisma.LeaveRequestGetPayload<{
  include: {
    employee: {
      select: {
        id: true
        name: true
        assignments: {
          where: { isPrimary: true; endDate: null }
          take: 1
          select: {
            jobGrade: { select: { name: true } }
            department: { select: { name: true } }
          }
        }
      }
    }
    policy: {
      select: { name: true; leaveType: true; isPaid: true }
    }
    approver: {
      select: {
        id: true
        name: true
        assignments: {
          where: { isPrimary: true; endDate: null }
          take: 1
          select: {
            jobGrade: { select: { name: true } }
            department: { select: { name: true } }
          }
        }
      }
    }
  }
}>

// ─── Status 매핑 ──────────────────────────────────────────

function mapLeaveStatus(status: string): UnifiedTaskStatus {
  switch (status) {
    case 'PENDING': return UnifiedTaskStatus.PENDING
    case 'APPROVED': return UnifiedTaskStatus.COMPLETED
    case 'REJECTED': return UnifiedTaskStatus.REJECTED
    case 'CANCELLED': return UnifiedTaskStatus.CANCELLED
    default: return UnifiedTaskStatus.PENDING
  }
}

// ─── Priority 추론 ─────────────────────────────────────────
// PENDING + 신청일로부터 3일 이내 = HIGH, 그 외 MEDIUM

function mapLeavePriority(
  status: string,
  createdAt: Date,
): UnifiedTaskPriority {
  if (status !== 'PENDING') return UnifiedTaskPriority.LOW

  const daysSinceCreated = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceCreated >= 3) return UnifiedTaskPriority.HIGH
  return UnifiedTaskPriority.MEDIUM
}

// ─── Actor 빌더 ────────────────────────────────────────────

function buildActor(
  employee: LeaveRequestWithRelations['employee'] | LeaveRequestWithRelations['approver'],
): UnifiedTaskActor {
  if (!employee) {
    return { employeeId: 'unknown', name: '알 수 없음' }
  }
  const assignment = extractPrimaryAssignment(employee.assignments ?? [])
  return {
    employeeId: employee.id,
    name: employee.name,
    position: assignment?.jobGrade?.name,
    department: assignment?.department?.name,
  }
}

// ─── Fallback assignee (승인자 미지정 시) ──────────────────

const UNASSIGNED_ACTOR: UnifiedTaskActor = {
  employeeId: 'unassigned',
  name: '미지정',
}

// ─── Mapper 구현 ───────────────────────────────────────────

class LeaveRequestMapper
  implements UnifiedTaskMapper<LeaveRequestWithRelations> {
  readonly type = UnifiedTaskType.LEAVE_APPROVAL

  toUnifiedTask(source: LeaveRequestWithRelations): UnifiedTask {
    const startDate = source.startDate.toISOString().slice(0, 10)
    const endDate = source.endDate.toISOString().slice(0, 10)
    const days = Number(source.days)

    const leaveLabel = source.policy?.name ?? '휴가'
    const requesterName = source.employee?.name ?? '알 수 없음'

    return {
      id: `LeaveRequest:${source.id}`,
      type: UnifiedTaskType.LEAVE_APPROVAL,
      status: mapLeaveStatus(source.status),
      priority: mapLeavePriority(source.status, source.createdAt),

      title: `${leaveLabel} ${days}일 신청 — ${requesterName}`,
      summary: `${startDate} ~ ${endDate}`,

      requester: buildActor(source.employee),
      assignee: source.approver ? buildActor(source.approver) : UNASSIGNED_ACTOR,

      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),

      sourceId: source.id,
      sourceModel: 'LeaveRequest',
      actionUrl: '/leave/team',

      companyId: source.companyId,

      metadata: {
        leaveType: source.policy?.leaveType ?? 'UNKNOWN',
        isPaid: source.policy?.isPaid ?? true,
        days,
        originalStatus: source.status,
        startDate,
        endDate,
        reason: source.reason ?? null,
        rejectionReason: source.rejectionReason ?? null,
        policyName: source.policy?.name ?? null,
      },
    }
  }

  toUnifiedTasks(sources: LeaveRequestWithRelations[]): UnifiedTask[] {
    return sources
      .map((s) => {
        try {
          if (!s.employee) {
            console.warn(`[leave.mapper] Orphaned LeaveRequest: ${s.id} — skipping`)
            return null
          }
          return this.toUnifiedTask(s)
        } catch (error) {
          console.error(`[leave.mapper] Error mapping LeaveRequest ${s.id}:`, error)
          return null
        }
      })
      .filter((t): t is UnifiedTask => t !== null)
  }
}

export const leaveRequestMapper = new LeaveRequestMapper()
