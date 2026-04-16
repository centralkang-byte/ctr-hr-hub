// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Query Context (AsyncLocalStorage)
// Phase 6A: Prisma Query Counter — opt-in per-request/per-test context
//
// The Prisma extension (query-counter-extension.ts) pushes records into
// the active store. When no store is active (getStore() returns undefined),
// the extension's `store?.records.push(...)` is a zero-cost no-op.
//
// Enable per-request tracking by wrapping a handler in `queryContextAls.run()`:
//   withPermission()/withAuth() do this when PRISMA_QUERY_DEBUG === '1'.
// Enable per-test tracking via `measureQueries()` / `withQueryBudget()` in
// `./query-budget.ts` — those helpers are the intended public API.
// ═══════════════════════════════════════════════════════════

import { AsyncLocalStorage } from 'node:async_hooks'

export interface QueryRecord {
  model: string | undefined
  operation: string
  durationMs: number
}

export interface QueryContextStore {
  records: QueryRecord[]
  startedAt: number
}

export const queryContextAls = new AsyncLocalStorage<QueryContextStore>()
