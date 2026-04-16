// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Playwright Query Budget helper (Phase 6A)
//
// Cross-process counterpart to `src/lib/observability/query-budget.ts`.
// Playwright API tests run in a separate Node process from the Next.js
// server, so in-test AsyncLocalStorage cannot see server-side queries.
// Instead the server attaches an `X-Query-Count` header to every response
// (gated by `PRISMA_QUERY_DEBUG=1` — see `src/lib/permissions.ts`), and
// this helper reads + asserts it.
//
// USAGE
//   const res = await request.get('/api/v1/employees')
//   await expectQueryBudget(res, 10, 'GET /api/v1/employees')
//
// ENFORCEMENT MODES
//   - CI (`process.env.CI`): strict — missing header throws. CI always
//     starts a fresh server with `webServer.env.PRISMA_QUERY_DEBUG=1`, so
//     an absent header means the server wasn't configured correctly.
//   - Local: lenient — missing header logs a warning and skips. This
//     supports `reuseExistingServer: true` workflows where `npm run dev`
//     was started without `PRISMA_QUERY_DEBUG=1`. Developers can opt into
//     strict mode locally by setting the env var on their dev server.
// ═══════════════════════════════════════════════════════════

import type { APIResponse } from '@playwright/test'
import { expect } from '@playwright/test'

const HEADER_NAME = 'x-query-count'
const IS_CI = Boolean(process.env.CI)

/**
 * Reads `X-Query-Count` from a Playwright API response and returns the
 * parsed number. Returns `null` if the header is absent.
 */
export function readQueryCount(response: APIResponse): number | null {
  const value = response.headers()[HEADER_NAME]
  if (value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Asserts that a response was produced by ≤ `budget` Prisma queries.
 *
 * On failure emits:
 *   Query budget exceeded: <label> — 47 > 10
 *
 * See ENFORCEMENT MODES in the file header for missing-header behavior
 * (strict in CI, lenient locally).
 */
export async function expectQueryBudget(
  response: APIResponse,
  budget: number,
  label: string,
): Promise<void> {
  const count = readQueryCount(response)

  if (count === null) {
    if (IS_CI) {
      throw new Error(
        `[query-budget] ${label} — missing X-Query-Count header in CI. ` +
          'playwright.config.ts webServer.env must set PRISMA_QUERY_DEBUG=1, ' +
          'and the server must run the withPermission/withAuth wrapper.',
      )
    }
    // Local: silently skip — developer is using reuseExistingServer with a
    // dev server started outside Playwright. Log once so it's not fully
    // invisible, but don't break the test run.
    // eslint-disable-next-line no-console
    console.warn(
      `[query-budget] ${label} — skipping (X-Query-Count header absent; ` +
        'start your dev server with PRISMA_QUERY_DEBUG=1 to enable budget assertions).',
    )
    return
  }

  // Always emit a uniform observation line BEFORE the budget comparison so
  // grep-based baseline workflows get one line per assertion regardless of
  // pass/fail. Stays stable across CI runs and compounds into ongoing
  // observability for future spec authors. No PII — label/numbers only.
  // eslint-disable-next-line no-console
  console.log(
    `[query-budget] ${label} observed=${count} budget=${budget} suggested=${Math.ceil(count * 1.2)}`,
  )

  if (count > budget) {
    // Playwright's expect gives us a nice diff view on failure.
    expect(
      count,
      `${label} query count (${count}) exceeds budget (${budget}). ` +
        `If the new value is intentional, update the inline constant to ` +
        `${Math.ceil(count * 1.2)} (observed ${count} × 1.2) and record the date.`,
    ).toBeLessThanOrEqual(budget)
  }
}

/**
 * Convenience: log the observed count without asserting. Used during the
 * initial baseline pass before a budget constant is committed.
 */
export function logQueryCount(response: APIResponse, label: string): void {
  const count = readQueryCount(response)
  if (count === null) {
    // eslint-disable-next-line no-console
    console.warn(
      `[query-budget] ${label} — no X-Query-Count header (PRISMA_QUERY_DEBUG unset?)`,
    )
    return
  }
  // eslint-disable-next-line no-console
  console.log(
    `[query-budget] ${label} observed=${count} suggested budget=${Math.ceil(count * 1.2)}`,
  )
}
