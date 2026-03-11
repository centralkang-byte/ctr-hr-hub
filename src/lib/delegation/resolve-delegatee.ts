// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Delegation Resolver
// src/lib/delegation/resolve-delegatee.ts
// ═══════════════════════════════════════════════════════════
//
// 핵심 로직: 현재 사용자가 특정 LeaveRequest를 대결 승인할
// 권한이 있는지 판단한다.
//
// 규칙:
//   1. 원래 승인권자(approvedBy) = 위임자(delegator)
//   2. 현재 사용자 = delegatee
//   3. delegation.status = ACTIVE
//   4. now() between startDate and endDate
//   5. scope가 LEAVE_ONLY 또는 ALL
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type { DelegationScope } from '@/generated/prisma/client'

export interface DelegationCheckResult {
  /** 대결 권한이 있는지 여부 */
  isDelegatee: boolean
  /** 대결 레코드 ID (있으면) */
  delegationId?: string
  /** 원래 승인권자 ID */
  delegatorId?: string
  /** 대결 범위 */
  scope?: DelegationScope
}

/**
 * 주어진 사용자(actorId)가 특정 승인권자(originalApproverId)의
 * 현재 활성 대결자인지 확인한다.
 *
 * @param actorId            - 현재 행동하는 사용자 (대결자 후보)
 * @param originalApproverId - 원래 승인권자 (위임자)
 * @param companyId          - 법인 ID
 * @param requiredScope      - 필요한 scope ('LEAVE_ONLY' | 'ALL')
 */
export async function checkDelegation(
  actorId: string,
  originalApproverId: string,
  companyId: string,
  requiredScope: 'LEAVE_ONLY' | 'ALL' = 'LEAVE_ONLY',
): Promise<DelegationCheckResult> {
  const now = new Date()

  const delegation = await prisma.approvalDelegation.findFirst({
    where: {
      delegatorId: originalApproverId,
      delegateeId: actorId,
      companyId,
      status: 'ACTIVE',
      startDate: { lte: now },
      endDate: { gte: now },
      scope: requiredScope === 'ALL'
        ? 'ALL'
        : { in: ['LEAVE_ONLY', 'ALL'] },
    },
    select: {
      id: true,
      delegatorId: true,
      scope: true,
    },
    orderBy: { startDate: 'desc' },
  })

  if (!delegation) {
    return { isDelegatee: false }
  }

  return {
    isDelegatee: true,
    delegationId: delegation.id,
    delegatorId: delegation.delegatorId,
    scope: delegation.scope,
  }
}

/**
 * 주어진 사용자가 대결자로서 처리할 수 있는 모든 활성 위임 건을 조회한다.
 * (Unified Task mapper에서 사용)
 *
 * @param delegateeId - 대결자 ID
 * @param companyId   - 법인 ID
 * @returns 활성 위임 건의 delegatorId 배열
 */
export async function getActiveDelegators(
  delegateeId: string,
  companyId: string,
): Promise<string[]> {
  const now = new Date()

  const delegations = await prisma.approvalDelegation.findMany({
    where: {
      delegateeId,
      companyId,
      status: 'ACTIVE',
      startDate: { lte: now },
      endDate: { gte: now },
    },
    select: { delegatorId: true },
  })

  return delegations.map((d) => d.delegatorId)
}

/**
 * 만료된 delegation을 자동으로 EXPIRED로 변경한다.
 * cron 또는 nudge 타이밍에 호출.
 */
export async function expireOverdueDelegations(): Promise<number> {
  const now = new Date()

  const result = await prisma.approvalDelegation.updateMany({
    where: {
      status: 'ACTIVE',
      endDate: { lt: now },
    },
    data: {
      status: 'EXPIRED',
    },
  })

  return result.count
}
