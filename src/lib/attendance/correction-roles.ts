import 'server-only'

import { prisma } from '@/lib/prisma'
import { ROLE } from '@/lib/constants'

type PrismaTx = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

const currentAssignmentFilter = () => ({
  isPrimary: true,
  endDate: null,
  status: { in: ['ACTIVE', 'ON_LEAVE'] },
})

export interface CorrectionReviewerScope {
  isGlobalSuper: boolean
  hrCompanyIds: string[]
}

export async function getCorrectionReviewerScope(
  db: PrismaTx,
  employeeId: string,
  now = new Date(),
): Promise<CorrectionReviewerScope> {
  const [employee, roles, assignments] = await Promise.all([
    db.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { id: true },
    }),
    db.employeeRole.findMany({
      where: {
        employeeId,
        startDate: { lte: now },
        endDate: null,
        role: { code: { in: [ROLE.HR_ADMIN, ROLE.SUPER_ADMIN] } },
      },
      select: { companyId: true, role: { select: { code: true } } },
    }),
    db.employeeAssignment.findMany({
      where: {
        employeeId,
        effectiveDate: { lte: now },
        ...currentAssignmentFilter(),
      },
      select: { companyId: true },
    }),
  ])

  if (!employee) return { isGlobalSuper: false, hrCompanyIds: [] }
  const assignmentCompanies = new Set(assignments.map((row) => row.companyId))

  return {
    isGlobalSuper:
      assignments.length > 0 && roles.some((row) => row.role.code === ROLE.SUPER_ADMIN),
    hrCompanyIds: roles
      .filter(
        (row) => row.role.code === ROLE.HR_ADMIN && assignmentCompanies.has(row.companyId),
      )
      .map((row) => row.companyId),
  }
}

export async function findCorrectionApproverIds(
  db: PrismaTx,
  companyId: string,
  requesterId: string,
  now = new Date(),
): Promise<string[]> {
  const hr = await db.employee.findMany({
    where: {
      id: { not: requesterId },
      deletedAt: null,
      employeeRoles: {
        some: {
          companyId,
          startDate: { lte: now },
          endDate: null,
          role: { code: ROLE.HR_ADMIN },
        },
      },
      assignments: {
        some: { companyId, effectiveDate: { lte: now }, ...currentAssignmentFilter() },
      },
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  if (hr.length > 0) return hr.map((employee) => employee.id)

  const globalSuper = await db.employee.findMany({
    where: {
      id: { not: requesterId },
      deletedAt: null,
      employeeRoles: {
        some: {
          startDate: { lte: now },
          endDate: null,
          role: { code: ROLE.SUPER_ADMIN },
        },
      },
      assignments: {
        some: { effectiveDate: { lte: now }, ...currentAssignmentFilter() },
      },
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  return globalSuper.map((employee) => employee.id)
}
