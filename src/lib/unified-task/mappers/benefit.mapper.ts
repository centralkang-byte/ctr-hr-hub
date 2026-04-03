// ═══════════════════════════════════════════════════════════
// CTR HR Hub — BenefitClaim → UnifiedTask Mapper
// src/lib/unified-task/mappers/benefit.mapper.ts
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

export type BenefitClaimWithRelations = Prisma.BenefitClaimGetPayload<{
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
    benefitPlan: {
      select: { name: true; category: true }
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

// ─── Prisma include 상수 ──────────────────────────────────

export const BENEFIT_CLAIM_INCLUDE = {
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
  benefitPlan: {
    select: { name: true, category: true },
  },
  approver: {
    select: {
      id: true,
      name: true,
      assignments: {
        where: { isPrimary: true, endDate: null },
        take: 1,
        select: {
          jobGrade: { select: { name: true } },
          department: { select: { name: true } },
        },
      },
    },
  },
} as const

// ─── Status 매핑 ──────────────────────────────────────────

function mapBenefitStatus(status: string): UnifiedTaskStatus {
  switch (status.toLowerCase()) {
    case 'pending':
      return UnifiedTaskStatus.PENDING
    case 'approved':
    case 'paid':
      return UnifiedTaskStatus.COMPLETED
    case 'rejected':
      return UnifiedTaskStatus.REJECTED
    default:
      return UnifiedTaskStatus.PENDING
  }
}

// ─── Actor 빌더 ───────────────────────────────────────────

function buildActor(emp: {
  id: string
  name: string
  assignments?: Array<{
    jobGrade?: { name: string } | null
    department?: { name: string } | null
  }>
} | null): UnifiedTaskActor {
  if (!emp) {
    return { employeeId: 'unknown', name: 'Unknown' }
  }
  const a = extractPrimaryAssignment(emp.assignments ?? [])
  return {
    employeeId: emp.id,
    name: emp.name,
    position: a?.jobGrade?.name ?? undefined,
    department: a?.department?.name ?? undefined,
  }
}

// ─── Mapper ───────────────────────────────────────────────

export const benefitClaimMapper: UnifiedTaskMapper<BenefitClaimWithRelations> = {
  type: UnifiedTaskType.BENEFIT_REQUEST,

  toUnifiedTask(claim: BenefitClaimWithRelations): UnifiedTask {
    const statusMapped = mapBenefitStatus(claim.status)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const companyId = (extractPrimaryAssignment(claim.employee.assignments ?? []) as any)?.companyId ?? 'unknown'

    return {
      id: `BenefitClaim:${claim.id}`,
      sourceId: claim.id,
      sourceModel: 'BenefitClaim',
      type: UnifiedTaskType.BENEFIT_REQUEST,
      status: statusMapped,
      priority: UnifiedTaskPriority.MEDIUM,
      title: `복리후생 신청: ${claim.benefitPlan.name}`,
      summary: `${claim.benefitPlan.category} — ₩${claim.claimAmount.toLocaleString()}`,
      requester: buildActor(claim.employee),
      assignee: buildActor(claim.approver),
      createdAt: claim.createdAt.toISOString(),
      updatedAt: claim.updatedAt.toISOString(),
      dueDate: undefined,
      companyId,
      actionUrl: `/benefits/claims/${claim.id}`,
      metadata: {
        planName: claim.benefitPlan.name,
        category: claim.benefitPlan.category,
        claimAmount: claim.claimAmount,
        approvedAmount: claim.approvedAmount,
        eventDate: claim.eventDate?.toISOString() ?? null,
        originalStatus: claim.status,
      },
    }
  },

  toUnifiedTasks(claims: BenefitClaimWithRelations[]): UnifiedTask[] {
    return claims.map((c) => this.toUnifiedTask(c))
  },
}
