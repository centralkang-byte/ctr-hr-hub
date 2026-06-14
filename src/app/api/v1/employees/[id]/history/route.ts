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

    // 멀티테넌트: 비-SUPER는 자기 법인 발령만. 전출 직원의 이전 법인 발령
    // (부서·직급·승인자 등 타 테넌트 조직 데이터) 노출 차단. SUPER는 그룹 전체.
    const assignments = await prisma.employeeAssignment.findMany({
      where: {
        employeeId: id,
        ...(user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }),
      },
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
