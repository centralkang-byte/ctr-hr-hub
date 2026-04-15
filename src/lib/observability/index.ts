// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Observability barrel
// Phase 6A: Query Counter + N+1 Detection
// ═══════════════════════════════════════════════════════════

export {
  queryContextAls,
  type QueryRecord,
  type QueryContextStore,
} from './query-context'

export { queryCounterExtension } from './query-counter-extension'

export {
  measureQueries,
  withQueryBudget,
  formatBudgetError,
  tallyByModel,
  type QueryMeasurement,
} from './query-budget'
