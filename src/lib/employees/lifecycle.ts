// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Lifecycle Badges (수습/계약 만료 파생)
// 순수 함수 — 날짜 비교는 UTC date-only (naive timestamp tz 함정 회피)
// ═══════════════════════════════════════════════════════════

export type LifecycleBadgeVariant = 'warning' | 'error' | 'info'

export interface LifecycleBadge {
  /** i18n 키 (employee 네임스페이스) */
  labelKey: 'probationInProgress' | 'probationOverdue' | 'contractExpiringSoon' | 'contractExpired'
  variant: LifecycleBadgeVariant
  /** 만료/종료까지 남은 일수 (경과 시 음수) */
  daysLeft: number
}

/** ISO/Date 값을 UTC 기준 date-only 일 수로 변환 (시각·타임존 성분 제거) */
function toUtcDayNumber(value: string | Date): number {
  const d = typeof value === 'string' ? new Date(value) : value
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86_400_000)
}

const CONTRACT_WARN_DAYS = 30

/**
 * 수습 배지 파생 — probationStatus가 IN_PROGRESS일 때만.
 * 종료일 경과 + 미처리(IN_PROGRESS)면 "만료 경과" 경고.
 */
export function deriveProbationBadge(
  probationEndDate: string | Date | null | undefined,
  probationStatus: string | null | undefined,
  now: Date,
): LifecycleBadge | null {
  if (!probationEndDate || probationStatus !== 'IN_PROGRESS') return null
  const daysLeft = toUtcDayNumber(probationEndDate) - toUtcDayNumber(now)
  if (daysLeft < 0) return { labelKey: 'probationOverdue', variant: 'error', daysLeft }
  return { labelKey: 'probationInProgress', variant: 'info', daysLeft }
}

/**
 * 계약 만료 배지 파생 — 만료일 D-30 이내 경고, 경과 시 에러.
 * 무기한(endDate null)·30일 초과 잔여는 배지 없음.
 */
export function deriveContractBadge(
  contractEndDate: string | Date | null | undefined,
  now: Date,
): LifecycleBadge | null {
  if (!contractEndDate) return null
  const daysLeft = toUtcDayNumber(contractEndDate) - toUtcDayNumber(now)
  if (daysLeft < 0) return { labelKey: 'contractExpired', variant: 'error', daysLeft }
  if (daysLeft <= CONTRACT_WARN_DAYS) return { labelKey: 'contractExpiringSoon', variant: 'warning', daysLeft }
  return null
}
