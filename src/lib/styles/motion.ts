/**
 * Motion tokens — R1 Dashboard Redesign
 * Linear/Attio 특유의 micro-interaction 기본값.
 * `motion-safe:` prefix는 각 컴포넌트에서 필요 시 적용 (prefers-reduced-motion 존중).
 */
export const MOTION = {
  /** 200ms ease-out — 호버, 색상 전환 */
  microOut: 'transition-all duration-200 ease-out',
  /** 300ms ease-out — 레이아웃 변화, 드롭다운 */
  standardOut: 'transition-all duration-300 ease-out',
  /** 카드 hover: 살짝 뜨는 효과 */
  hoverLift: 'transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm',
  /** Fade in — 컨텐츠 로드 */
  fadeIn: 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200',
} as const

export type Motion = keyof typeof MOTION
