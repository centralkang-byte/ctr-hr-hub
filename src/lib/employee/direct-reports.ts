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
 *
 * Note (Session 206): 본 helper는 status 필터를 적용하지 않는다. RESIGNED/TERMINATED
 * 직원도 endDate=null assignment를 보유할 수 있으나(in-progress offboarding —
 * `offboarding/start`는 status만 update), 본 helper의 caller(home/summary, 1:1,
 * off-cycle comp 등)는 광범위한 도메인이라 일괄 status allowlist는 회귀 위험이
 * 크다 (probationary/legacy seed status 값 누락 등). 결재 라우트처럼 status 강제가
 * 필수인 caller는 자체 SQL/쿼리에서 status IN ('ACTIVE', 'ON_LEAVE')를 inline
 * 처리한다 (validate-requisition-approver.ts, requisitions/route.ts myApprovals).
 */
export async function getDirectReportIds(managerId: string): Promise<string[]> {
  // "현재 활성" = effectiveDate<=now AND (endDate==null OR endDate>now) — assignments.ts SSOT 패턴.
  // 예약 조직개편 시 createAssignment가 현 발령 endDate를 미래로, 신 발령 effectiveDate를 미래로 두므로
  // endDate:null 단독이면 (a) 미래 매니저가 미래 팀원을 조기 포함 (b) 현 발령(미래 endDate)이 사라짐 —
  // 권한 게이트(nominations·check-in 팀스코프)가 본 helper를 쓰므로 양쪽 다 오류 (Codex Gate2 P1).
  const now = new Date()
  const activeNow = { effectiveDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gt: now } }] }

  // Collect ALL active positions held by this manager (primary + secondary)
  const managerAsgns = await prisma.employeeAssignment.findMany({
    where: { employeeId: managerId, ...activeNow },
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
      ...activeNow,
    },
    select: { employeeId: true },
  })

  // Deduplicate (same employee could report via multiple positions)
  return [...new Set(reportAsgns.map((a) => a.employeeId))]
}

/**
 * 직속부하 중 "현재 자사 primary 발령 보유자"만 남기는 재필터 (⑥-C).
 * getDirectReportIds 는 발령 status 를 안 거르므로(날짜창만), 퇴직/전출/타법인을
 * 여기서 배제해야 한다 (manager-hub members/announce/activity 와 동일 의미론).
 * statuses 기본값에 PROBATION 포함 — 온보딩 대상(신입/인턴)의 발령 status 가
 * PROBATION 이라 ACTIVE-only 면 온보딩 스코프가 통째로 비게 된다.
 */
export async function getActiveTeamMemberIds(
  managerId: string,
  companyId: string,
  statuses: string[] = ['ACTIVE', 'ON_LEAVE', 'PROBATION'],
): Promise<string[]> {
  const directIds = await getDirectReportIds(managerId)
  if (directIds.length === 0) return []
  const now = new Date()
  const rows = await prisma.employee.findMany({
    where: {
      id: { in: directIds },
      assignments: {
        some: {
          companyId,
          isPrimary: true,
          status: { in: statuses },
          effectiveDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gt: now } }],
        },
      },
    },
    select: { id: true },
  })
  return rows.map((r) => r.id)
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
