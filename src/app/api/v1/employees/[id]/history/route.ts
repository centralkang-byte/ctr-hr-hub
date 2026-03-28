// ═══════════════════════════════════════════════════════════
// GET /api/v1/employees/[id]/history
// 발령이력 타임라인용 — EmployeeAssignment 기반
// ═══════════════════════════════════════════════════════════
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const scopeFilter =
      user.role === 'SUPER_ADMIN'
        ? {}
        : { assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } } }

    const employee = await prisma.employee.findFirst({
      where: { id, deletedAt: null, ...scopeFilter },
      select: { id: true, hireDate: true },
    })
    if (!employee) throw notFound('직원을 찾을 수 없습니다.')

    const assignments = await prisma.employeeAssignment.findMany({
      where: { employeeId: id },
      include: {
        company:     { select: { id: true, name: true } },
        department:  { select: { id: true, name: true } },
        jobGrade:    { select: { id: true, name: true, code: true } },
        jobCategory: { select: { id: true, name: true } },
        position:    { select: { id: true, titleKo: true, titleEn: true } },
        approver:    { select: { id: true, name: true, photoUrl: true } },
      },
      orderBy: { effectiveDate: 'desc' },
    })

    return apiSuccess({ assignments, hireDate: employee.hireDate })
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
