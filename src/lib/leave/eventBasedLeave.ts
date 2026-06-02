// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Event-Based (Non-Accruing) Leave Detection
// 이벤트/권리형 휴가(경조사·병가 등) 판별 SSOT.
//
// 적립형(연차 등)은 LeaveAccrualRule이 있어 LeaveYearBalance로 잔액을 추적한다.
// 이벤트형은 accrual rule이 없어 잔액 row가 생성되지 않으며, 사건 발생 시
// 정책 정의 일수(maxConsecutiveDays ?? policy.defaultDays)로 검증한다.
// accrualEngine(규칙 없으면 null 반환 → balance 미생성)의 거울상.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

type TxPrisma = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// ─── 순수 함수 ───────────────────────────────────────────────

/**
 * 적립형(잔액 추적) 여부 — 순수.
 * active accrual rule이 1개 이상이면 LeaveYearBalance로 추적되는 적립형.
 */
export function isBalanceTracked(activeAccrualRuleCount: number): boolean {
  return activeAccrualRuleCount > 0
}

/**
 * 이벤트형 휴가의 정책 정의 일수 상한 — 순수.
 * typedef.maxConsecutiveDays 우선, 없으면 policy.defaultDays fallback.
 * 둘 다 없으면 null(상한 미정).
 */
export function resolveEventLeaveDayCap(opts: {
  maxConsecutiveDays?: number | null
  policyDefaultDays?: number | null
}): number | null {
  const { maxConsecutiveDays, policyDefaultDays } = opts
  if (maxConsecutiveDays != null && maxConsecutiveDays > 0) return maxConsecutiveDays
  if (policyDefaultDays != null && policyDefaultDays > 0) return policyDefaultDays
  return null
}

// ─── DB 래퍼 ────────────────────────────────────────────────

/**
 * 휴가 유형이 잔액(LeaveYearBalance) 추적 대상인지 조회.
 * accrualEngine과 동일하게 `deletedAt: null` 규칙 존재 여부로 판단한다(거울상).
 * 규칙이 없으면 이벤트형 → 신청/승인/반려 시 잔액 검증을 우회한다.
 * tx 전달 시 트랜잭션 내부에서 실행.
 */
export async function leaveTypeUsesBalance(
  leaveTypeDefId: string,
  db?: TxPrisma,
): Promise<boolean> {
  const client = db ?? prisma
  const count = await client.leaveAccrualRule.count({
    where: { leaveTypeDefId, deletedAt: null },
  })
  return isBalanceTracked(count)
}
