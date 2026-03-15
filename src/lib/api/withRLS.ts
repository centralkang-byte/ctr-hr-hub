// ═══════════════════════════════════════════════════════════
// CTR HR Hub — withRLS() Transaction Wrapper
// Phase Q-5e: Row-Level Security Infrastructure
//
// Convenience wrapper that sets RLS context inside a Prisma
// transaction, then runs your callback.
//
// Usage:
//   const result = await withRLS(prisma, {
//     companyId: user.companyId,
//     userRole: user.role,
//     employeeId: user.employeeId,
//   }, (tx) => tx.payrollRun.findUnique({ where: { id } }))
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { setRLSContext, type RLSContext, type PrismaTx } from '@/lib/prisma-rls'
import type { SessionUser } from '@/types'

/**
 * Execute Prisma queries with RLS context set.
 *
 * Wraps the callback in a $transaction:
 *   1. SET LOCAL session variables (company, role, employee)
 *   2. Runs your callback — all queries respect RLS policies
 *   3. Transaction closes, session variables are cleared
 *
 * TIP: The existing `WHERE companyId = ?` in queries is kept as a
 * redundant safety net. Both layers are independent defenses.
 */
export async function withRLS<T>(
  ctx: RLSContext,
  callback: (tx: PrismaTx) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await setRLSContext(tx, ctx)
    return callback(tx)
  })
}

/**
 * Build RLSContext from a SessionUser.
 * Convenience helper to avoid repetitive field extraction in routes.
 */
export function buildRLSContext(user: SessionUser): RLSContext {
  return {
    companyId: user.companyId ?? '',
    userRole: user.role,
    employeeId: user.employeeId ?? undefined,
  }
}
