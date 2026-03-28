import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import { ROLE } from '@/lib/constants'

/**
 * B-3g: Cross-company READ access — Option A
 * Allows MANAGER+ to read dotted-line/secondary employees in other companies.
 *
 * Security 3-layer check (AND):
 * 1. Caller role >= MANAGER
 * 2. Caller has dottedLinePositionId OR secondary assignment in another company
 * 3. Target employee is in caller's dotted/secondary relationship
 *
 * Protected files NOT modified: resolveCompanyId(), prisma-rls.ts, withRLS.ts
 */

const MANAGER_PLUS_ROLES: string[] = [
  ROLE.SUPER_ADMIN,
  ROLE.HR_ADMIN,
  ROLE.EXECUTIVE,
  ROLE.MANAGER,
]

interface CrossCompanyContext {
  callerEmployeeId: string
  callerRole: string
  callerCompanyId: string
}

// ── Single target verification (for detail views) ──
export async function verifyCrossCompanyAccess(
  ctx: CrossCompanyContext,
  targetEmployeeId: string,
): Promise<{ allowed: boolean; readOnly: true }> {
  // Check 1: MANAGER+
  if (!MANAGER_PLUS_ROLES.includes(ctx.callerRole)) {
    return { allowed: false, readOnly: true }
  }

  // Check 2 & 3: Relationship exists
  const relationships = await getCallerCrossCompanyRelationships(ctx)
  if (relationships.relatedEmployeeIds.size === 0) {
    return { allowed: false, readOnly: true }
  }

  return {
    allowed: relationships.relatedEmployeeIds.has(targetEmployeeId),
    readOnly: true,
  }
}

// ── Batch filter builder (for list views) — N+1 prevention ──
export async function getCrossCompanyReadFilter(
  ctx: CrossCompanyContext,
): Promise<Prisma.EmployeeWhereInput | null> {
  // Check 1: MANAGER+
  if (!MANAGER_PLUS_ROLES.includes(ctx.callerRole)) {
    return null
  }

  const relationships = await getCallerCrossCompanyRelationships(ctx)
  if (relationships.relatedEmployeeIds.size === 0) {
    return null
  }

  // Return WHERE clause that includes cross-company employees
  return {
    id: { in: Array.from(relationships.relatedEmployeeIds) },
  }
}

// ── Internal: resolve all cross-company relationships in 1 query batch ──
async function getCallerCrossCompanyRelationships(ctx: CrossCompanyContext) {
  const relatedEmployeeIds = new Set<string>()

  // Path A: Dotted line — find employees whose position has dottedLinePositionId pointing to caller's position
  const callerAssignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId: ctx.callerEmployeeId,
      isPrimary: true,
      endDate: null,
      effectiveDate: { lte: new Date() },
    },
    select: { positionId: true },
  })

  if (callerAssignment?.positionId) {
    // Employees whose position's dottedLinePositionId = caller's positionId
    const dottedEmployees = await prisma.employeeAssignment.findMany({
      where: {
        isPrimary: true,
        endDate: null,
        effectiveDate: { lte: new Date() },
        position: { dottedLinePositionId: callerAssignment.positionId },
        companyId: { not: ctx.callerCompanyId },
      },
      select: { employeeId: true },
    })
    for (const e of dottedEmployees) relatedEmployeeIds.add(e.employeeId)
  }

  // Path B: Secondary assignments — caller has secondary in another company
  const callerSecondaries = await prisma.employeeAssignment.findMany({
    where: {
      employeeId: ctx.callerEmployeeId,
      isPrimary: false,
      endDate: null,
      effectiveDate: { lte: new Date() },
      companyId: { not: ctx.callerCompanyId },
    },
    select: { companyId: true, positionId: true },
  })

  if (callerSecondaries.length > 0) {
    const secondaryCompanyIds = callerSecondaries.map((s) => s.companyId)
    const secondaryPositionIds = callerSecondaries
      .map((s) => s.positionId)
      .filter((id): id is string => id !== null)

    // Employees who report to caller's secondary positions
    if (secondaryPositionIds.length > 0) {
      const reportingEmployees = await prisma.employeeAssignment.findMany({
        where: {
          isPrimary: true,
          endDate: null,
          effectiveDate: { lte: new Date() },
          companyId: { in: secondaryCompanyIds },
          position: {
            reportsToPositionId: { in: secondaryPositionIds },
          },
        },
        select: { employeeId: true },
      })
      for (const e of reportingEmployees) relatedEmployeeIds.add(e.employeeId)
    }

    // Also include all employees in companies where caller has secondary assignment
    // (for org chart visibility — READ-ONLY)
    const companyEmployees = await prisma.employeeAssignment.findMany({
      where: {
        isPrimary: true,
        endDate: null,
        effectiveDate: { lte: new Date() },
        companyId: { in: secondaryCompanyIds },
        employeeId: { not: ctx.callerEmployeeId },
      },
      select: { employeeId: true },
    })
    for (const e of companyEmployees) relatedEmployeeIds.add(e.employeeId)
  }

  return { relatedEmployeeIds }
}
