import { prisma } from '@/lib/prisma'

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
