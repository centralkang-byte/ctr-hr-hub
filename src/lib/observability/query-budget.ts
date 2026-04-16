// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Query Budget Test Helpers
// Phase 6A: Opt-in per-test query measurement + budget assertions.
//
// `measureQueries` is the low-level primitive — returns all records.
// `withQueryBudget` is the asserting wrapper — throws with a pretty
// breakdown when `budget` is exceeded (count-based, v1 N+1 proxy).
//
// These helpers are intended for Vitest unit tests and in-process
// code measurement. Playwright API tests run in a separate process
// and must read the `X-Query-Count` response header instead — see
// `e2e/helpers/query-budget.ts`.
// ═══════════════════════════════════════════════════════════

import {
  queryContextAls,
  type QueryContextStore,
  type QueryRecord,
} from './query-context'

export interface QueryMeasurement<T> {
  result: T
  records: QueryRecord[]
  count: number
  byModel: Record<string, number>
  totalDurationMs: number
}

/**
 * Runs `fn` inside an AsyncLocalStorage context that captures every Prisma
 * query fired during its execution (including queries in awaited promises,
 * transactions, and service-layer helpers). Returns the measurement data.
 *
 * Off-path cost when no context is active is ~200ns per query (one
 * `getStore()?.push` call in the extension), so the extension can stay
 * permanently installed on the global client.
 */
export async function measureQueries<T>(
  fn: () => Promise<T>,
): Promise<QueryMeasurement<T>> {
  const store: QueryContextStore = { records: [], startedAt: Date.now() }
  const result = await queryContextAls.run(store, fn)
  return {
    result,
    records: store.records,
    count: store.records.length,
    byModel: tallyByModel(store.records),
    totalDurationMs: store.records.reduce((sum, r) => sum + r.durationMs, 0),
  }
}

/**
 * Like `measureQueries`, but throws a descriptive error if the query count
 * exceeds `budget`. The error message includes a per-model breakdown and
 * flags likely N+1 suspects (any model.operation repeated > 5 times).
 *
 * @param budget - maximum allowed query count (inclusive)
 * @param label - human-readable description for error messages
 * @param fn - the async function to measure
 */
export async function withQueryBudget<T>(
  budget: number,
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  const m = await measureQueries(fn)
  if (m.count > budget) {
    throw new Error(formatBudgetError(label, budget, m))
  }
  return m.result
}

/**
 * Groups records by `model.operation` key and returns counts.
 * Raw queries (model undefined) are grouped under `raw.<operation>`.
 */
export function tallyByModel(
  records: readonly QueryRecord[],
): Record<string, number> {
  const tally: Record<string, number> = {}
  for (const r of records) {
    const key = r.model ? `${r.model}.${r.operation}` : `raw.${r.operation}`
    tally[key] = (tally[key] ?? 0) + 1
  }
  return tally
}

/**
 * Groups records by `model.operation` and returns counts + total duration.
 * Used for failure message formatting.
 */
function tallyByModelDetailed(
  records: readonly QueryRecord[],
): Array<{ key: string; count: number; totalMs: number }> {
  const map = new Map<string, { count: number; totalMs: number }>()
  for (const r of records) {
    const key = r.model ? `${r.model}.${r.operation}` : `raw.${r.operation}`
    const entry = map.get(key) ?? { count: 0, totalMs: 0 }
    entry.count += 1
    entry.totalMs += r.durationMs
    map.set(key, entry)
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.count - a.count || b.totalMs - a.totalMs)
}

/**
 * Formats a budget-exceeded error with a per-model breakdown. Entries with
 * count > 5 get a trailing `← N+1 suspect` marker so failures point at the
 * probable root cause without needing a separate N+1 detector.
 */
export function formatBudgetError<T>(
  label: string,
  budget: number,
  m: QueryMeasurement<T>,
): string {
  const breakdown = tallyByModelDetailed(m.records)
  const lines = breakdown.map((b) => {
    const suffix = b.count > 5 ? '  ← N+1 suspect' : ''
    return `  ${b.key.padEnd(40)} × ${String(b.count).padStart(3)}  (${b.totalMs.toFixed(1)}ms)${suffix}`
  })
  return [
    `Query budget exceeded: ${label} — ${m.count} > ${budget}`,
    ...lines,
    `  suggested budget: ${Math.ceil(m.count * 1.2)}  (observed ${m.count} × 1.2)`,
  ].join('\n')
}
