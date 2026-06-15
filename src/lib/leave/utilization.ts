// ════════════════════════════════════════════════════════════════
// CTR HR Hub — 휴가 사용률 SSOT (PR2: 레거시 EmployeeLeaveBalance 퇴출)
// ════════════════════════════════════════════════════════════════
// 단일 정의 (CEO 결정 2026-06-15):
//   • 분모 = 가용분(available) = entitled + carriedOver + adjusted
//   • 범위 = 연차(annual)만 — leaveTypeDef.code = 'annual'
//   • 회사 스코프 = 자사 annual def + 글로벌(null) def, 타사 def 제외 (전출자 누출 차단)
// 순수 산술(leaveAvailable/Rate/Remaining)과 Prisma where 빌더(annualBalanceWhere)를 분리.

/** LeaveYearBalance 의 숫자 필드 부분집합 (Prisma 비의존 — 순수 산술 입력). */
export interface LeaveBalanceAmounts {
  entitled: number
  used: number
  carriedOver: number
  adjusted: number
  pending: number
}

/** 가용분 = 직원이 실제 쓸 수 있는 총 휴가일수. 음수 adjusted 방어(<=0 → 0). 분모 용도. */
export function leaveAvailable(
  b: Pick<LeaveBalanceAmounts, 'entitled' | 'carriedOver' | 'adjusted'>,
): number {
  const available = b.entitled + b.carriedOver + b.adjusted
  return available > 0 ? available : 0
}

/**
 * 사용률 = used / available.
 * available <= 0 → null (분모 0 정책: 0% 위장 금지 · 집계에서 제외). NaN/Infinity 차단.
 */
export function leaveUtilizationRate(used: number, available: number): number | null {
  if (!(available > 0)) return null
  const rate = used / available
  return Number.isFinite(rate) ? rate : null
}

/** 표시용 잔여 = 가용분 - 사용 - 신청중 (이미 마이그된 home/summary·offboarding/me와 동일 식). */
export function leaveRemaining(b: LeaveBalanceAmounts): number {
  return b.entitled + b.carriedOver + b.adjusted - b.used - b.pending
}

/**
 * annual-only + 회사 스코프 LeaveYearBalance.where 조각.
 * LeaveTypeDef는 법인별 모델(글로벌 companyId=null 공존) →
 *   companyId 지정 시: 자사 annual def OR 글로벌 annual def, 타사 def 제외(전출자 잔여행 차단).
 *   companyId=null (SUPER 통합뷰): 전 법인 annual def.
 */
export function annualBalanceWhere(companyId: string | null) {
  if (!companyId) {
    return { leaveTypeDef: { code: 'annual' } }
  }
  return {
    leaveTypeDef: {
      code: 'annual',
      OR: [{ companyId }, { companyId: null }],
    },
  }
}
