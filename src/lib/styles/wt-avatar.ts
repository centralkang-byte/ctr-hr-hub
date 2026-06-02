// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Workday wt 아바타/부서 색 SSOT (Phase 2 P2a-avatar)
// 도메인 아바타·부서 노드 색을 Workday --wt 팔레트 단일 소스로 통합.
// 직원: id 안정 해시 → 같은 사람 = 어느 화면에서나 같은 색 (F7).
// 부서: 부서 인덱스 단일 헬퍼 (직원 해시 불요 — 별 의미).
// 라이트만 (다크 wt 미정의 = known-deferred, 별도 다크 Phase).
// ═══════════════════════════════════════════════════════════

// hue 패밀리 교차 순: 시각 인접 슬롯의 색을 분리해 식별성 최대화
// (navy → terracotta → forest → gold → purple → teal → coral → steel)
// avatar·dept·chart 시리즈 공용 wt 슬롯 SSOT (P2b-chart에서 재사용).
export const WT_ORDER = [1, 3, 5, 6, 4, 2, 8, 7] as const

/** 슬롯(임의 정수) → `hsl(var(--wt-N))`. 8 초과는 교차순 순환 재사용. */
export function wtSlotColor(slot: number): string {
  const n = WT_ORDER[((slot % 8) + 8) % 8]
  return `hsl(var(--wt-${n}))`
}

/**
 * 직원 id → 안정 wt 색. 같은 id = 항상 같은 색 (페이지·정렬·필터 무관).
 * charCodeSum % 8 — 단순·무의존, 8슬롯 균등 분포 충분.
 */
export function wtAvatarColor(employeeId: string): string {
  let sum = 0
  for (let i = 0; i < employeeId.length; i++) sum += employeeId.charCodeAt(i)
  return wtSlotColor(sum)
}

/** 부서 노드 색 — 부서 인덱스 기반 (직원 해시 아님). */
export function wtDeptColor(deptIndex: number): string {
  return wtSlotColor(deptIndex)
}
