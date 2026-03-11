/** Art.3 — Transition speeds */
export const TRANSITIONS = {
  fast: { duration: 0.15, ease: 'easeOut' as const },
  normal: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const },
  slow: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
  spring: { type: 'spring' as const, stiffness: 300, damping: 30 },
} as const
