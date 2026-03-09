// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Nudge Module Barrel Export
// src/lib/nudge/index.ts
// ═══════════════════════════════════════════════════════════

export { checkNudgesForUser }  from './check-nudges'
export { NudgeEngine }         from './nudge-engine'
export { leavePendingRule }    from './rules/leave-pending.rule'
export { payrollReviewRule }   from './rules/payroll-review.rule'
export type {
  NudgeRule,
  NudgeThresholds,
  NudgeEngineConfig,
  OverdueItem,
  NudgeResult,
  NudgeRunSummary,
} from './types'
