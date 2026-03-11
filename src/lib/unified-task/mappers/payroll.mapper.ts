// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PayrollRun → UnifiedTask Mapper
// src/lib/unified-task/mappers/payroll.mapper.ts
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

export type PayrollRunWithRelations = Prisma.PayrollRunGetPayload<{
  include: {
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

function mapPayrollStatus(status: string): UnifiedTaskStatus {
  switch (status) {
    case 'DRAFT': return UnifiedTaskStatus.PENDING
    case 'CALCULATING': return UnifiedTaskStatus.IN_PROGRESS
    case 'REVIEW': return UnifiedTaskStatus.IN_PROGRESS
    case 'APPROVED': return UnifiedTaskStatus.COMPLETED
    case 'PAID': return UnifiedTaskStatus.COMPLETED
    case 'CANCELLED': return UnifiedTaskStatus.CANCELLED
    default: return UnifiedTaskStatus.PENDING
  }
}

// ─── Priority 추론 ─────────────────────────────────────────
// REVIEW(검토 필요) = HIGH, DRAFT(대기) = MEDIUM, 완료/취소 = LOW

function mapPayrollPriority(status: string): UnifiedTaskPriority {
  switch (status) {
    case 'REVIEW': return UnifiedTaskPriority.HIGH
    case 'DRAFT':
    case 'CALCULATING': return UnifiedTaskPriority.MEDIUM
    default: return UnifiedTaskPriority.LOW
  }
}

// ─── Actor 빌더 ────────────────────────────────────────────

function buildApproverActor(
  approver: PayrollRunWithRelations['approver'],
): UnifiedTaskActor {
  if (!approver) {
    return { employeeId: 'unassigned', name: 'HR / 재무팀' }
  }
  const assignment = approver.assignments?.[0]
  return {
    employeeId: approver.id,
    name: approver.name,
    position: assignment?.jobGrade?.name,
    department: assignment?.department?.name,
  }
}

// PayrollRun의 requester = 생성한 시스템/HR (companyId 기반 표현)
function buildSystemActor(companyId: string): UnifiedTaskActor {
  return {
    employeeId: `system:${companyId}`,
    name: '급여 시스템',
  }
}

// ─── Mapper 구현 ───────────────────────────────────────────

class PayrollRunMapper
  implements UnifiedTaskMapper<PayrollRunWithRelations> {
  readonly type = UnifiedTaskType.PAYROLL_REVIEW

  toUnifiedTask(source: PayrollRunWithRelations): UnifiedTask {
    const totalNet = source.totalNet ? Number(source.totalNet) : 0

    // 상태 라벨 (title에 포함)
    const statusLabel: Record<string, string> = {
      DRAFT: '초안',
      CALCULATING: '계산 중',
      REVIEW: '검토 필요',
      APPROVED: '승인됨',
      PAID: '지급 완료',
      CANCELLED: '취소됨',
    }
    const statusText = statusLabel[source.status] ?? source.status

    return {
      id: `PayrollRun:${source.id}`,
      type: UnifiedTaskType.PAYROLL_REVIEW,
      status: mapPayrollStatus(source.status),
      priority: mapPayrollPriority(source.status),

      title: `${source.yearMonth} 급여 실행 — ${statusText}`,
      summary: `${source.headcount}명 · ${totalNet.toLocaleString('ko-KR')} ${source.currency}`,

      requester: buildSystemActor(source.companyId),
      assignee: buildApproverActor(source.approver),

      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
      dueDate: source.payDate?.toISOString(),

      sourceId: source.id,
      sourceModel: 'PayrollRun',
      actionUrl: `/payroll/${source.id}/review`,

      companyId: source.companyId,

      metadata: {
        period: source.yearMonth,
        runType: source.runType,
        headcount: source.headcount,
        totalGross: source.totalGross ? Number(source.totalGross) : null,
        totalNet,
        currency: source.currency,
        originalStatus: source.status,
        approvedAt: source.approvedAt?.toISOString() ?? null,
        paidAt: source.paidAt?.toISOString() ?? null,
      },
    }
  }

  toUnifiedTasks(sources: PayrollRunWithRelations[]): UnifiedTask[] {
    return sources
      .map((s) => {
        try {
          return this.toUnifiedTask(s)
        } catch (error) {
          console.error(`[payroll.mapper] Error mapping PayrollRun ${s.id}:`, error)
          return null
        }
      })
      .filter((t): t is UnifiedTask => t !== null)
  }
}

export const payrollRunMapper = new PayrollRunMapper()
