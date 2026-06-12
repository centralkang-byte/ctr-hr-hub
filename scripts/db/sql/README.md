# scripts/db/sql — Manual SQL artifacts (NOT Prisma migrations)

SQL files here are intentionally **outside** `prisma/migrations/` so that
`prisma migrate dev`/`deploy` never picks them up. Each is applied manually
(or by a runner script) with its own review gate.

| File | Status | How it runs |
|------|--------|-------------|
| `mv_analytics.sql` | Ready — 8 analytics MVs (idempotent DROP+CREATE). Initial apply pending approval. | `scripts/db/apply-analytics-mv.ts` (STAGING_DB_CONFIRM guard) |
| `rls_setup.sql` | **DO NOT APPLY** — RLS re-apply deferred post-launch (CEO decision). Contains 2 KNOWN-BROKEN column refs, marked inline. | Manual, via the future RLS re-apply track |
| `rename-performance-grade.sql` | Historical one-off (2026-04-06 PerformanceGrade enum rename, ADR exists). Superseded — schema.prisma now defines O/E/M/S directly and the shared DB was rebuilt via `db push` (S250). Record-only. | Manual (superseded) |

Rule: never put loose SQL files or non-timestamped directories inside
`prisma/migrations/` — Prisma treats every subdirectory there as a migration.
