// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Query Counter unit tests (Phase 6A)
//
// Covers:
//   - AsyncLocalStorage propagation across await chains, Promise.all,
//     nested async callbacks, and unawaited background work
//   - measureQueries: records, counts, byModel tally, total duration
//   - withQueryBudget: passes when under budget, throws with pretty
//     breakdown when exceeded, includes N+1 suspect marker, suggests
//     new budget
//   - formatBudgetError: edge cases (single query, raw-only, mixed)
//   - Concurrent store isolation: two parallel measureQueries calls
//     never bleed records into each other
//   - No-op off-path cost when no store is active
//
// These tests simulate the extension's behavior by pushing records into
// `queryContextAls.getStore()` directly — they do not import the real
// `queryCounterExtension`, because that would pull in `@/generated/prisma/client`.
// Integration of the real extension is verified in a separate manual smoke
// test (see plan file §2 "Dev Smoke Test").
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  queryContextAls,
  measureQueries,
  withQueryBudget,
  formatBudgetError,
  tallyByModel,
  type QueryRecord,
} from '@/lib/observability'

// ─── Test helpers ───────────────────────────────────────────

/** Simulates a Prisma query firing the extension hook. */
function simulateQuery(
  model: string | undefined,
  operation: string,
  durationMs = 1,
) {
  queryContextAls.getStore()?.records.push({ model, operation, durationMs })
}

async function simulateAsyncQuery(
  model: string | undefined,
  operation: string,
  durationMs = 1,
) {
  await Promise.resolve()
  simulateQuery(model, operation, durationMs)
}

// ─── measureQueries ─────────────────────────────────────────

describe('measureQueries', () => {
  it('captures queries fired inside the callback', async () => {
    const m = await measureQueries(async () => {
      simulateQuery('employee', 'findMany', 10)
      simulateQuery('assignment', 'findMany', 5)
      return 'ok'
    })

    expect(m.result).toBe('ok')
    expect(m.count).toBe(2)
    expect(m.records).toHaveLength(2)
    expect(m.totalDurationMs).toBe(15)
    expect(m.byModel).toEqual({
      'employee.findMany': 1,
      'assignment.findMany': 1,
    })
  })

  it('propagates context across await chains', async () => {
    const m = await measureQueries(async () => {
      await simulateAsyncQuery('employee', 'findMany')
      await simulateAsyncQuery('company', 'findUnique')
      await Promise.resolve().then(() =>
        simulateQuery('department', 'findMany'),
      )
    })

    expect(m.count).toBe(3)
  })

  it('propagates context across Promise.all', async () => {
    const m = await measureQueries(async () => {
      await Promise.all([
        simulateAsyncQuery('employee', 'findMany'),
        simulateAsyncQuery('leave', 'findMany'),
        simulateAsyncQuery('payroll', 'findMany'),
      ])
    })

    expect(m.count).toBe(3)
  })

  it('propagates context through nested async callbacks (transaction-like)', async () => {
    const fakeTransaction = async (
      cb: (tx: { run: () => Promise<void> }) => Promise<void>,
    ) => {
      await cb({
        run: async () => {
          simulateQuery('employee', 'findMany', 2)
        },
      })
    }

    const m = await measureQueries(async () => {
      await fakeTransaction(async (tx) => {
        await tx.run()
        simulateQuery('assignment', 'findMany', 3)
      })
    })

    expect(m.count).toBe(2)
    expect(m.byModel).toEqual({
      'employee.findMany': 1,
      'assignment.findMany': 1,
    })
  })

  it('isolates stores across concurrent measureQueries calls', async () => {
    const [a, b] = await Promise.all([
      measureQueries(async () => {
        await simulateAsyncQuery('a', 'findMany')
        await simulateAsyncQuery('a', 'findMany')
      }),
      measureQueries(async () => {
        await simulateAsyncQuery('b', 'findMany')
      }),
    ])

    expect(a.count).toBe(2)
    expect(b.count).toBe(1)
    expect(a.byModel).toEqual({ 'a.findMany': 2 })
    expect(b.byModel).toEqual({ 'b.findMany': 1 })
  })

  it('returns zero count when the callback fires no queries', async () => {
    const m = await measureQueries(async () => 'noop')
    expect(m.count).toBe(0)
    expect(m.records).toEqual([])
    expect(m.totalDurationMs).toBe(0)
  })

  it('captures raw queries (model undefined) under raw.<operation>', async () => {
    const m = await measureQueries(async () => {
      simulateQuery(undefined, '$queryRawUnsafe', 4)
      simulateQuery(undefined, '$executeRawUnsafe', 2)
    })

    expect(m.count).toBe(2)
    expect(m.byModel).toEqual({
      'raw.$queryRawUnsafe': 1,
      'raw.$executeRawUnsafe': 1,
    })
  })
})

// ─── withQueryBudget ────────────────────────────────────────

describe('withQueryBudget', () => {
  it('passes when count is within budget', async () => {
    const result = await withQueryBudget(5, 'test', async () => {
      simulateQuery('a', 'findMany')
      simulateQuery('b', 'findMany')
      return 42
    })
    expect(result).toBe(42)
  })

  it('passes at exact budget boundary', async () => {
    await withQueryBudget(2, 'boundary', async () => {
      simulateQuery('a', 'findMany')
      simulateQuery('b', 'findMany')
    })
  })

  it('throws when count exceeds budget', async () => {
    await expect(
      withQueryBudget(2, 'overflow', async () => {
        simulateQuery('a', 'findMany')
        simulateQuery('b', 'findMany')
        simulateQuery('c', 'findMany')
      }),
    ).rejects.toThrow(/Query budget exceeded: overflow — 3 > 2/)
  })

  it('error message includes the model breakdown', async () => {
    let error: Error | null = null
    try {
      await withQueryBudget(1, 'break', async () => {
        simulateQuery('employee', 'findMany', 12)
        simulateQuery('assignment', 'findMany', 180)
      })
    } catch (e) {
      error = e as Error
    }
    expect(error).toBeTruthy()
    expect(error!.message).toContain('employee.findMany')
    expect(error!.message).toContain('assignment.findMany')
    expect(error!.message).toContain('× ')
  })

  it('flags N+1 suspects (count > 5) with a marker', async () => {
    let error: Error | null = null
    try {
      await withQueryBudget(2, 'n-plus-one', async () => {
        for (let i = 0; i < 7; i++) {
          simulateQuery('assignment', 'findMany', 10)
        }
      })
    } catch (e) {
      error = e as Error
    }
    expect(error!.message).toContain('N+1 suspect')
  })

  it('suggests a new budget value (observed × 1.2)', async () => {
    let error: Error | null = null
    try {
      await withQueryBudget(2, 'suggest', async () => {
        for (let i = 0; i < 10; i++) {
          simulateQuery('a', 'findMany')
        }
      })
    } catch (e) {
      error = e as Error
    }
    expect(error!.message).toContain('suggested budget: 12')
  })
})

// ─── formatBudgetError ──────────────────────────────────────

describe('formatBudgetError', () => {
  it('formats a single-record breakdown', () => {
    const msg = formatBudgetError('GET /x', 0, {
      result: null,
      records: [{ model: 'user', operation: 'findMany', durationMs: 10 }],
      count: 1,
      byModel: { 'user.findMany': 1 },
      totalDurationMs: 10,
    })
    expect(msg).toContain('GET /x — 1 > 0')
    expect(msg).toContain('user.findMany')
    expect(msg).toContain('× ')
    expect(msg).not.toContain('N+1 suspect')
  })

  it('sorts entries by count descending', () => {
    const records: QueryRecord[] = [
      { model: 'a', operation: 'findMany', durationMs: 1 },
      { model: 'b', operation: 'findMany', durationMs: 1 },
      { model: 'b', operation: 'findMany', durationMs: 1 },
      { model: 'b', operation: 'findMany', durationMs: 1 },
    ]
    const msg = formatBudgetError('x', 0, {
      result: null,
      records,
      count: records.length,
      byModel: tallyByModel(records),
      totalDurationMs: 4,
    })
    // b.findMany (3) should appear before a.findMany (1)
    const bIndex = msg.indexOf('b.findMany')
    const aIndex = msg.indexOf('a.findMany')
    expect(bIndex).toBeGreaterThan(-1)
    expect(aIndex).toBeGreaterThan(bIndex)
  })

  it('groups raw queries under raw.<operation>', () => {
    const records: QueryRecord[] = [
      { model: undefined, operation: '$executeRawUnsafe', durationMs: 1 },
      { model: undefined, operation: '$queryRaw', durationMs: 2 },
    ]
    const msg = formatBudgetError('x', 0, {
      result: null,
      records,
      count: 2,
      byModel: tallyByModel(records),
      totalDurationMs: 3,
    })
    expect(msg).toContain('raw.$executeRawUnsafe')
    expect(msg).toContain('raw.$queryRaw')
  })
})

// ─── Store absence (off-path) ───────────────────────────────

describe('queryContextAls off-path behavior', () => {
  it('getStore() returns undefined when no measureQueries is active', () => {
    expect(queryContextAls.getStore()).toBeUndefined()
  })

  it('simulating a query outside measureQueries is a no-op', () => {
    // Should not throw
    simulateQuery('noop', 'findMany')
  })
})

// ─── tallyByModel ───────────────────────────────────────────

describe('tallyByModel', () => {
  it('handles an empty record list', () => {
    expect(tallyByModel([])).toEqual({})
  })

  it('counts model.operation keys correctly', () => {
    const records: QueryRecord[] = [
      { model: 'a', operation: 'findMany', durationMs: 1 },
      { model: 'a', operation: 'findMany', durationMs: 1 },
      { model: 'a', operation: 'create', durationMs: 1 },
      { model: undefined, operation: '$queryRaw', durationMs: 1 },
    ]
    expect(tallyByModel(records)).toEqual({
      'a.findMany': 2,
      'a.create': 1,
      'raw.$queryRaw': 1,
    })
  })
})
