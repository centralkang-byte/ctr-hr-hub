// ═══════════════════════════════════════════════════════════
// GET /api/v1/employees/[id]/snapshot?date=YYYY-MM-DD
// 특정 시점의 직원 소속/직급 상태 조회 (Effective Dating)
// ═══════════════════════════════════════════════════════════
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, badRequest } from '@/lib/errors'
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
    const dateParam = req.nextUrl.searchParams.get('date')
    if (!dateParam) throw badRequest('date 파라미터가 필요합니다.')

    const targetDate = new Date(dateParam)
    if (isNaN(targetDate.getTime())) throw badRequest('유효하지 않은 날짜 형식입니다.')

    const scopeFilter =
      user.role === 'SUPER_ADMIN'
        ? {}
        : { assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } } }

    const employee = await prisma.employee.findFirst({
      where: { id, deletedAt: null, ...scopeFilter },
      select: { id: true, name: true, employeeNo: true, photoUrl: true, hireDate: true },
    })
    if (!employee) throw notFound('직원을 찾을 수 없습니다.')

    // hireDate 이전 날짜는 조회 불가
    if (employee.hireDate && targetDate < new Date(employee.hireDate)) {
      return apiSuccess({
        date: dateParam,
        employee: { id: employee.id, name: employee.name, employeeNo: employee.employeeNo, photoUrl: employee.photoUrl },
        assignment: null,
        message: '입사일 이전의 데이터는 존재하지 않습니다.',
      })
    }

    // Effective Dating 쿼리: 해당 시점에 유효한 primary assignment
    const assignment = await prisma.employeeAssignment.findFirst({
      where: {
        employeeId: id,
        isPrimary: true,
        effectiveDate: { lte: targetDate },
        OR: [
          { endDate: null },
          { endDate: { gt: targetDate } },
        ],
      },
      include: {
        company:     { select: { id: true, name: true } },
        department:  { select: { id: true, name: true } },
        jobGrade:    { select: { id: true, name: true } },
        jobCategory: { select: { id: true, name: true } },
      },
      orderBy: { effectiveDate: 'desc' },
    })

    return apiSuccess({
      date: dateParam,
      employee,
      assignment: assignment ?? null,
    })
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
