import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { isAppError, handlePrismaError, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

const assignmentSelect = {
  employee: {
    select: { id: true, name: true, nameEn: true },
  },
  company: { select: { id: true, name: true, code: true } },
  position: { select: { titleKo: true, titleEn: true } },
} as const

export const GET = withPermission(
  async (
    _req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      if (user.role === ROLE.EMPLOYEE) throw forbidden('매니저 이상만 접근 가능합니다.')

      const callerEmployeeId = user.employeeId
      const callerCompanyId = user.companyId

      // Step 1: Find caller's primary position
      const callerAssignment = await prisma.employeeAssignment.findFirst({
        where: {
          employeeId: callerEmployeeId,
          isPrimary: true,
          endDate: null,
          effectiveDate: { lte: new Date() },
        },
        select: { positionId: true },
      })

      if (!callerAssignment?.positionId) {
        return apiSuccess({ employees: [], callerCompanyId })
      }

      // Step 2: Path A — Dotted line reports
      // ⚠️ 법인 필터 없음! 같은 법인 + 타 법인 점선 보고 모두 포함
      // cross-company-access.ts는 "타 법인 READ 보안"용이므로 여기서는 직접 조회.
      // 점선 보고 관계 자체는 보안 이슈가 아님 (매니저의 position에 연결된 관계).
      const dottedLineAssignments = await prisma.employeeAssignment.findMany({
        where: {
          isPrimary: true,
          endDate: null,
          effectiveDate: { lte: new Date() },
          position: { dottedLinePositionId: callerAssignment.positionId },
          employeeId: { not: callerEmployeeId },
        },
        select: assignmentSelect,
      })

      // Step 3: Path B — Secondary assignment direct reports
      // 겸직 포지션의 직속 부하 조회 (매니저 본인의 포지션이므로 별도 보안 게이트 불필요)
      const callerSecondaries = await prisma.employeeAssignment.findMany({
        where: {
          employeeId: callerEmployeeId,
          isPrimary: false,
          endDate: null,
          effectiveDate: { lte: new Date() },
        },
        select: { positionId: true },
      })
      const secondaryPositionIds = callerSecondaries
        .map((s) => s.positionId)
        .filter((id): id is string => id !== null)

      let secondaryReportAssignments: typeof dottedLineAssignments = []
      if (secondaryPositionIds.length > 0) {
        secondaryReportAssignments = await prisma.employeeAssignment.findMany({
          where: {
            isPrimary: true,
            endDate: null,
            effectiveDate: { lte: new Date() },
            position: { reportsToPositionId: { in: secondaryPositionIds } },
            employeeId: { not: callerEmployeeId },
          },
          select: assignmentSelect,
        })
      }

      // Step 4: Deduplicate — exclude solid-line direct reports (already in existing panels)
      const solidLineReportIds = new Set(
        (
          await prisma.employeeAssignment.findMany({
            where: {
              isPrimary: true,
              endDate: null,
              effectiveDate: { lte: new Date() },
              position: { reportsToPositionId: callerAssignment.positionId },
            },
            select: { employeeId: true },
          })
        ).map((a) => a.employeeId),
      )

      const seen = new Set<string>()
      const employees: {
        id: string
        name: string
        companyName: string
        companyCode: string
        companyId: string
        positionTitle: string
        relationship: 'DOTTED_LINE' | 'SECONDARY_REPORT'
      }[] = []

      const format = (
        a: (typeof dottedLineAssignments)[number],
        rel: 'DOTTED_LINE' | 'SECONDARY_REPORT',
      ) => ({
        id: a.employee.id,
        name: a.employee.name || a.employee.nameEn || '',
        companyName: a.company.name,
        companyCode: a.company.code,
        companyId: a.company.id,
        positionTitle: a.position?.titleKo || a.position?.titleEn || '',
        relationship: rel,
      })

      for (const a of dottedLineAssignments) {
        if (seen.has(a.employee.id) || solidLineReportIds.has(a.employee.id)) continue
        seen.add(a.employee.id)
        employees.push(format(a, 'DOTTED_LINE'))
      }

      for (const a of secondaryReportAssignments) {
        if (seen.has(a.employee.id) || solidLineReportIds.has(a.employee.id)) continue
        seen.add(a.employee.id)
        employees.push(format(a, 'SECONDARY_REPORT'))
      }

      return apiSuccess({ employees, callerCompanyId })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
