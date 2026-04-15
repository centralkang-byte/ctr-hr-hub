// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Prisma Query Counter Extension
// Phase 6A: hooks every Prisma query (model op + raw SQL) to
//   1) push a record into the active QueryContextStore (opt-in, test-only)
//   2) log per-query timing to stdout when PRISMA_LOG_QUERIES=1 (dev only)
//   3) emit a Sentry warning when a query exceeds SLOW_QUERY_MS (prod only,
//      sampled by SLOW_QUERY_SAMPLE_RATE, never includes args → zero PII risk)
//
// Uses top-level `query: { $allOperations }` so the hook fires for BOTH
// model operations (`prisma.user.findMany(...)`) and raw queries
// (`prisma.$executeRawUnsafe(...)`, `$queryRaw`, etc.). `model` is `undefined`
// for raw queries, see Prisma docs: client-extensions/query.
// ═══════════════════════════════════════════════════════════

import { Prisma } from '@/generated/prisma/client'
import * as Sentry from '@sentry/nextjs'
import { queryContextAls } from './query-context'

const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS ?? 1000)
const SLOW_QUERY_SAMPLE_RATE = Number(
  process.env.SLOW_QUERY_SAMPLE_RATE ?? 0.1,
)
const DEV_LOG = process.env.PRISMA_LOG_QUERIES === '1'

// Guard against accidental production leak of the debug flag.
if (
  process.env.NODE_ENV === 'production' &&
  process.env.PRISMA_QUERY_DEBUG === '1'
) {
  console.warn(
    '[query-counter] PRISMA_QUERY_DEBUG=1 in production — X-Query-Count headers will expose internal query counts.',
  )
}

export const queryCounterExtension = Prisma.defineExtension({
  name: 'ctr-query-counter',
  query: {
    async $allOperations({ model, operation, args, query }) {
      const start = performance.now()
      try {
        return await query(args)
      } finally {
        const durationMs = performance.now() - start

        queryContextAls.getStore()?.records.push({
          model,
          operation,
          durationMs,
        })

        if (DEV_LOG) {
          const label = model ? `${model}.${operation}` : operation
          // eslint-disable-next-line no-console
          console.log(`[prisma] ${label} ${durationMs.toFixed(1)}ms`)
        }

        if (
          durationMs > SLOW_QUERY_MS &&
          process.env.NODE_ENV === 'production' &&
          Math.random() < SLOW_QUERY_SAMPLE_RATE
        ) {
          try {
            Sentry.captureMessage('Slow Prisma query', {
              level: 'warning',
              tags: { model: model ?? 'raw', operation },
              // NOTE: `args` is deliberately NOT included — it may contain
              // user input (names, emails) that would leak as PII via Sentry.
              extra: { durationMs: Math.round(durationMs) },
              fingerprint: ['slow-prisma-query', model ?? 'raw', operation],
            })
          } catch {
            // Fire-and-forget: Sentry failures must never break requests.
          }
        }
      }
    },
  },
})
