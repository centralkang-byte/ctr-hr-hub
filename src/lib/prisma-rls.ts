// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Prisma RLS Context Setter
// Phase Q-5e: Row-Level Security Infrastructure
//
// USAGE: Always call setRLSContext() INSIDE a $transaction.
// SET LOCAL is scoped to the current transaction.
//
// Example:
//   const result = await prisma.$transaction(async (tx) => {
//     await setRLSContext(tx, { companyId, userRole, employeeId })
//     return tx.employee.findMany()
//   })
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

// Prisma transaction client type — same pattern as offboarding-complete.ts
export type PrismaTx = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

export interface RLSContext {
  companyId: string
  userRole: string
  employeeId?: string
}

// ─── SQL Injection Protection ────────────────────────────────
// Only allow alphanumeric, hyphens, underscores (valid for UUIDs and role names)
const SAFE_PATTERN = /^[a-zA-Z0-9_-]+$/

function sanitize(value: string, fieldName: string): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (!SAFE_PATTERN.test(trimmed)) {
    throw new Error(
      `[RLS] Invalid characters in ${fieldName}: "${trimmed}". ` +
        'Only alphanumeric, hyphen, and underscore characters are allowed.',
    )
  }
  return trimmed
}

// ─── setRLSContext ────────────────────────────────────────────

/**
 * Sets PostgreSQL session variables for RLS enforcement.
 *
 * MUST be called inside a $transaction — SET LOCAL is transaction-scoped.
 * After the transaction ends, variables are automatically cleared.
 *
 * @param tx  Prisma transaction client (from $transaction callback)
 * @param ctx RLS context: companyId, userRole, optional employeeId
 */
export async function setRLSContext(tx: PrismaTx, ctx: RLSContext): Promise<void> {
  const safeCompanyId = sanitize(ctx.companyId, 'companyId')
  const safeRole = sanitize(ctx.userRole, 'userRole')

  // SET LOCAL is safe to use with string interpolation AFTER sanitization
  await tx.$executeRawUnsafe(
    `SET LOCAL "app.current_company_id" = '${safeCompanyId}'`,
  )
  await tx.$executeRawUnsafe(
    `SET LOCAL "app.current_user_role" = '${safeRole}'`,
  )

  if (ctx.employeeId) {
    const safeEmpId = sanitize(ctx.employeeId, 'employeeId')
    await tx.$executeRawUnsafe(
      `SET LOCAL "app.current_employee_id" = '${safeEmpId}'`,
    )
  }
}
