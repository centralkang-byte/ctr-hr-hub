import { prisma } from '@/lib/prisma'
import { getCrossCompanyReadFilter } from '@/lib/api/cross-company-access'

/**
 * Get employee IDs of direct reports via position hierarchy.
 * Scans ALL active assignments (primary + secondary) to find manager's positions,
 * then finds employees whose position.reportsToPositionId matches any of them.
 *
 * Why not isPrimary-only: A manager may hold a team lead position as a secondary
 * assignment (e.g., primary=일반팀원, secondary=타팀 팀장). Filtering by isPrimary
 * would make their team invisible.
 */
export async function getDirectReportIds(managerId: string): Promise<string[]> {
  // Collect ALL active positions held by this manager (primary + secondary)
  const managerAsgns = await prisma.employeeAssignment.findMany({
    where: { employeeId: managerId, endDate: null },
    select: { positionId: true },
  })

  const positionIds = managerAsgns
    .map((a) => a.positionId)
    .filter((id): id is string => id !== null)

  if (positionIds.length === 0) return []

  const reportAsgns = await prisma.employeeAssignment.findMany({
    where: {
      position: { reportsToPositionId: { in: positionIds } },
      isPrimary: true,
      endDate: null,
    },
    select: { employeeId: true },
  })

  // Deduplicate (same employee could report via multiple positions)
  return [...new Set(reportAsgns.map((a) => a.employeeId))]
}

/**
 * Canonical "모든 팀원" resolver — direct reports + cross-company dotted-line.
 * Used by home/summary and manager-hub/summary to ensure both routes see the
 * identical team scope. Without this helper, home/summary missed cross-company
 * dotted-line reports that manager-hub/summary already included (Batch 7 D1).
 *
 * - Direct reports: via `getDirectReportIds` (primary + secondary positions)
 * - Cross-company: via `getCrossCompanyReadFilter` (dotted line + secondary in other company)
 * - Deduplicated Set → Array
 */
export async function getAllReportIds(args: {
  managerId: string
  role: string
  companyId: string
}): Promise<string[]> {
  const directIds = await getDirectReportIds(args.managerId)
  const crossFilter = await getCrossCompanyReadFilter({
    callerEmployeeId: args.managerId,
    callerRole: args.role,
    callerCompanyId: args.companyId,
  })
  const crossIds: string[] = crossFilter
    ? (
        await prisma.employee.findMany({
          where: crossFilter,
          select: { id: true },
        })
      ).map((r) => r.id)
    : []
  return [...new Set([...directIds, ...crossIds])]
}

/**
 * Get the manager's employee ID for a given employee, via position hierarchy.
 * Checks both primary and secondary assignments to find the manager holding
 * the reportsToPositionId.
 * Returns null if no manager found.
 */
export async function getManagerIdByPosition(employeeId: string): Promise<string | null> {
  const empAsgn = await prisma.employeeAssignment.findFirst({
    where: { employeeId, isPrimary: true, endDate: null },
    include: {
      position: { select: { reportsToPositionId: true } },
    },
  })

  if (!empAsgn?.position?.reportsToPositionId) return null

  // Find who holds the reportsTo position (could be primary or secondary assignment)
  const managerAsgn = await prisma.employeeAssignment.findFirst({
    where: {
      positionId: empAsgn.position.reportsToPositionId,
      endDate: null,
    },
    select: { employeeId: true },
  })

  return managerAsgn?.employeeId ?? null
}

/**
 * Batch-resolve manager IDs for multiple employees.
 * Uses 2 batch queries instead of N individual lookups.
 * Returns Map<employeeId, managerId>.
 */
export async function resolveManagerIds(
  employeeIds: string[],
): Promise<Map<string, string>> {
  if (employeeIds.length === 0) return new Map()

  // 1. Batch-fetch primary assignments with position hierarchy
  const assignments = await prisma.employeeAssignment.findMany({
    where: { employeeId: { in: employeeIds }, isPrimary: true, endDate: null },
    select: {
      employeeId: true,
      position: { select: { reportsToPositionId: true } },
    },
  })

  // Collect unique reportsToPositionIds
  const reportsToIds = [
    ...new Set(
      assignments
        .map((a) => a.position?.reportsToPositionId)
        .filter((id): id is string => id !== null),
    ),
  ]

  if (reportsToIds.length === 0) return new Map()

  // 2. Batch-fetch who holds those manager positions
  const managerAssignments = await prisma.employeeAssignment.findMany({
    where: { positionId: { in: reportsToIds }, endDate: null },
    select: { positionId: true, employeeId: true },
  })

  // Build positionId → managerId map (first holder wins)
  const positionToManager = new Map<string, string>()
  for (const ma of managerAssignments) {
    if (ma.positionId && !positionToManager.has(ma.positionId)) {
      positionToManager.set(ma.positionId, ma.employeeId)
    }
  }

  // Build employeeId → managerId result
  const result = new Map<string, string>()
  for (const asgn of assignments) {
    const reportsTo = asgn.position?.reportsToPositionId
    if (reportsTo) {
      const managerId = positionToManager.get(reportsTo)
      if (managerId) {
        result.set(asgn.employeeId, managerId)
      }
    }
  }

  return result
}
