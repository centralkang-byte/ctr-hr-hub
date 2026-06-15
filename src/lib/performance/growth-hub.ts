// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 평가/성장 허브 공유 계약 타입
// 자식(목표/분기리뷰/자기평가)이 헤더 1차 액션을 허브에 등록하는 callback-registration.
// 프로토 page-wrappers.jsx PerfGrowthWrapper 헤더 액션 버튼을 실제 작동시키기 위함.
// ═══════════════════════════════════════════════════════════

import type { LucideIcon } from 'lucide-react'

export type HubTabKey = 'goals' | 'quarterly' | 'skills'

/**
 * 자식이 허브 헤더에 등록하는 1차 액션 디스크립터.
 * 허브는 활성 탭의 디스크립터로 헤더 버튼 1개를 반응형 렌더(visible/enabled/pending).
 */
export interface PrimaryActionState {
  /** i18n 키 (performance.growth.action.* 에 상대) */
  labelKey: string
  /** 버튼 아이콘 (Lucide) — pending 시 스피너로 대체 */
  icon?: LucideIcon
  /** 실행 가능 여부 → 버튼 disabled 구동 */
  enabled: boolean
  /** 노출 여부 (예: 편집가능 리뷰 없음 → 숨김) */
  visible: boolean
  /** 진행 중(저장 등) → 스피너 + disabled */
  pending?: boolean
  /** 실제 동작 — 자식 내부 핸들러 호출 (가짜 toast 금지) */
  run: () => void | Promise<void>
}

/**
 * 허브 탭으로 임베드되는 자식 클라이언트의 공통 props (additive).
 * - embedded=true: 자식의 자체 페이지 헤더(h1+부제)·페이지 컨테이너 패딩 제거 (허브가 헤더 제공)
 * - onPrimaryActionChange: 자식이 1차 액션 등록(state)/해제(null)
 */
export interface EmbeddedChildProps {
  embedded?: boolean
  onPrimaryActionChange?: (state: PrimaryActionState | null) => void
}

/**
 * 허브 헤더 KPI 칩 데이터 — 서버에서 unmasked PerformanceCycle 로 계산해 전달.
 * 데이터 없으면(현재 사이클 없음) null → 칩 미노출.
 */
export interface GrowthHubKpi {
  /** 현재 사이클명 */
  cycleName: string
  /** 사이클 반기 (H1/H2/ANNUAL) — name 없을 때 라벨 fallback */
  cycleHalf: string
  /** 평가 마감까지 일수 (회사 tz). 음수 = 마감 경과 → 칩 생략 */
  dday: number
  /** 승인된(진행 중) 목표 수 */
  approvedGoals: number
}
