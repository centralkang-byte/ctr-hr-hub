/**
 * Elevation scale — R1 Dashboard Redesign
 * Finer granularity than default Tailwind shadow-sm/md/lg for Linear/Attio aesthetic.
 * Tonal layering 우선 (design.md No-Line Rule) — border 대신 subtle shadow로 depth 표현.
 */
export const ELEVATION = {
  /** 가장 얇은 카드, 인라인 배지 */
  xs: 'shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
  /** 기본 카드 */
  sm: 'shadow-[0_2px_4px_rgba(15,23,42,0.06)]',
  /** 드롭다운, popover */
  md: 'shadow-[0_4px_12px_rgba(15,23,42,0.08)]',
  /** 모달 */
  lg: 'shadow-[0_8px_24px_rgba(15,23,42,0.10)]',
  /** 플로팅 다이얼로그, toast */
  xl: 'shadow-[0_16px_48px_rgba(15,23,42,0.14)]',
  /** Hero 내부 상단 하이라이트 (subtle inner shadow) */
  innerSubtle: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]',
} as const

export type Elevation = keyof typeof ELEVATION
