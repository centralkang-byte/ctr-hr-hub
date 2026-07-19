import { prisma } from '@/lib/prisma'
import type { PrismaTx } from '@/lib/prisma-rls'

export type YearEndOwnerDb = Pick<PrismaTx, 'employeeAssignment'>

export interface YearEndOwnerAssignment {
  id: string
  employeeId: string
  companyId: string
  effectiveDate: Date
  endDate: Date | null
  company: { id: string; name: string }
  department: { id: string; name: string } | null
  jobGrade: { id: string; name: string } | null
}

export type YearEndOwnerResolution<T extends { companyId: string }> =
  | { resolved: true; companyId: string; assignment: T }
  | { resolved: false; reason: 'NO_ASSIGNMENT' | 'MULTIPLE_COMPANIES' }

export function getYearEndOwnershipWindow(year: number): {
  start: Date
  endExclusive: Date
} {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    endExclusive: new Date(Date.UTC(year + 1, 0, 1)),
  }
}

export function resolveYearEndOwner<
  T extends {
    id: string
    companyId: string
    effectiveDate: Date
    endDate: Date | null
  },
>(assignments: readonly T[]): YearEndOwnerResolution<T> {
  const occupyingAssignments = assignments.filter(
    (assignment) =>
      assignment.endDate === null ||
      assignment.endDate.getTime() > assignment.effectiveDate.getTime(),
  )
  if (occupyingAssignments.length === 0) {
    return { resolved: false, reason: 'NO_ASSIGNMENT' }
  }

  const companyIds = new Set(
    occupyingAssignments.map((assignment) => assignment.companyId),
  )
  if (companyIds.size !== 1) {
    return { resolved: false, reason: 'MULTIPLE_COMPANIES' }
  }

  const assignment = occupyingAssignments.reduce((latest, candidate) => {
    const effectiveDateDiff =
      candidate.effectiveDate.getTime() - latest.effectiveDate.getTime()
    if (effectiveDateDiff !== 0) return effectiveDateDiff > 0 ? candidate : latest
    return candidate.id.localeCompare(latest.id) > 0 ? candidate : latest
  })

  return { resolved: true, companyId: assignment.companyId, assignment }
}

export async function readYearEndOwners(
  employeeIds: readonly string[],
  year: number,
  db: YearEndOwnerDb = prisma,
): Promise<Map<string, YearEndOwnerResolution<YearEndOwnerAssignment>>> {
  const uniqueEmployeeIds = [...new Set(employeeIds)]
  const assignmentsByEmployee = new Map<string, YearEndOwnerAssignment[]>(
    uniqueEmployeeIds.map((employeeId) => [employeeId, []]),
  )

  if (uniqueEmployeeIds.length > 0) {
    const { start, endExclusive } = getYearEndOwnershipWindow(year)
    const assignments = await db.employeeAssignment.findMany({
      where: {
        employeeId: { in: uniqueEmployeeIds },
        isPrimary: true,
        effectiveDate: { lt: endExclusive },
        OR: [{ endDate: null }, { endDate: { gt: start } }],
      },
      orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        employeeId: true,
        companyId: true,
        effectiveDate: true,
        endDate: true,
        company: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        jobGrade: { select: { id: true, name: true } },
      },
    })

    for (const assignment of assignments) {
      assignmentsByEmployee.get(assignment.employeeId)?.push(assignment)
    }
  }

  return new Map(
    uniqueEmployeeIds.map((employeeId) => [
      employeeId,
      resolveYearEndOwner(assignmentsByEmployee.get(employeeId) ?? []),
    ]),
  )
}

export async function readYearEndOwner(
  employeeId: string,
  year: number,
  db: YearEndOwnerDb = prisma,
): Promise<YearEndOwnerResolution<YearEndOwnerAssignment>> {
  const owners = await readYearEndOwners([employeeId], year, db)
  return owners.get(employeeId) ?? { resolved: false, reason: 'NO_ASSIGNMENT' }
}
