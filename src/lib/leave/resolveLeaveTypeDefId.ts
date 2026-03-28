// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Resolve LeaveTypeDef from LeavePolicy
// policyId → leaveTypeDefId 매핑 (Phase 6: balance 전환용)
//
// LeavePolicy.leaveType (enum) → LeaveTypeDef.category/code 매핑
// 회사 우선, 글로벌(null) fallback
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

// LeaveType enum → LeaveTypeDef 매핑 기준
const LEAVE_TYPE_TO_FILTER: Record<string, { category?: string; code?: string }> = {
  ANNUAL:       { category: 'annual' },
  SICK:         { code: 'sick' },
  MATERNITY:    { category: 'maternity' },
  PATERNITY:    { code: 'childbirth_spouse' },
  BEREAVEMENT:  { category: 'family_event' },  // 첫 번째 매칭 (부모사망 등)
  SPECIAL:      { category: 'other' },
  COMPENSATORY: { code: 'compensatory' },
}

type TxPrisma = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/**
 * policyId → leaveTypeDefId 해결.
 * LeavePolicy의 leaveType + companyId로 LeaveTypeDef를 찾는다.
 * tx 전달 시 트랜잭션 내부에서 실행.
 */
export async function resolveLeaveTypeDefId(
  policyId: string,
  tx?: TxPrisma,
): Promise<string | null> {
  const db = tx ?? prisma

  const policy = await db.leavePolicy.findUnique({
    where: { id: policyId },
    select: { leaveType: true, companyId: true },
  })
  if (!policy) return null

  return resolveByLeaveType(policy.leaveType, policy.companyId, db)
}

/**
 * LeaveType enum + companyId → leaveTypeDefId 직접 해결.
 * 마이그레이션 스크립트 등에서 policy 없이 사용.
 */
export async function resolveByLeaveType(
  leaveType: string,
  companyId: string,
  db?: TxPrisma,
): Promise<string | null> {
  const client = db ?? prisma
  const filter = LEAVE_TYPE_TO_FILTER[leaveType]
  if (!filter) return null

  // category 또는 code로 검색 (회사 우선, 글로벌 fallback)
  const where = {
    isActive: true,
    OR: [
      { companyId },
      { companyId: null },
    ],
    ...(filter.category ? { category: filter.category } : {}),
    ...(filter.code ? { code: filter.code } : {}),
  }

  const typeDef = await client.leaveTypeDef.findFirst({
    where,
    orderBy: { companyId: 'desc' },  // 회사 specific 우선
    select: { id: true },
  })

  return typeDef?.id ?? null
}
