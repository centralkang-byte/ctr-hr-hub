/**
 * Client-safe re-export of extractPrimaryAssignment.
 *
 * assignment-helpers.ts imports prisma (server-only), so 'use client'
 * components cannot import it directly. This file contains the same
 * pure in-memory function without any server dependencies.
 *
 * @see assignment-helpers.ts for the canonical implementation and docs.
 */

/**
 * In-Memory Filter — for list APIs / client components where assignments
 * are already loaded.
 *
 * Fallback chain:
 *   1. isPrimary && !endDate && effectiveDate <= now
 *   2. isPrimary (primary with endDate — terminated but was primary)
 *   3. Most recent by effectiveDate (last resort — data integrity warning)
 */
export function extractPrimaryAssignment<T extends Record<string, unknown>>(assignments: T[]): T | undefined {
  if (!assignments || assignments.length === 0) return undefined
  if (assignments.length === 1) return assignments[0]

  const now = new Date()

  const hasPrimary = (a: T) => 'isPrimary' in a && a.isPrimary === true
  const hasEndDate = (a: T) => 'endDate' in a && a.endDate != null
  const getEffectiveDate = (a: T): Date | null => {
    if (!('effectiveDate' in a) || !a.effectiveDate) return null
    return new Date(a.effectiveDate as string | Date)
  }

  // 1st priority: active primary
  const activePrimary = assignments.find(a => {
    if (!hasPrimary(a)) return false
    if (hasEndDate(a)) return false
    const ed = getEffectiveDate(a)
    return ed ? ed <= now : true
  })
  if (activePrimary) return activePrimary

  // 2nd priority: any primary (even ended)
  const anyPrimary = assignments.find(a => hasPrimary(a))
  if (anyPrimary) return anyPrimary

  // 3rd fallback
  console.warn(
    `[assignment-helpers] No isPrimary found for employee with ${assignments.length} assignments`
  )
  const withDates = assignments.filter(a => getEffectiveDate(a) !== null)
  if (withDates.length > 0) {
    return [...withDates].sort(
      (a, b) => getEffectiveDate(b)!.getTime() - getEffectiveDate(a)!.getTime()
    )[0]
  }
  return assignments[0]
}
