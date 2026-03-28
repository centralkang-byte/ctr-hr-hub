import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/leave/balances/[employeeId] ─────────────
// Employee's leave balances (HR view)
// B-3h: 겸직자도 Primary Assignment의 법인 기준으로만 잔여일 조회

export const GET = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { employeeId } = await context.params

    // Verify employee exists and belongs to same company (unless SUPER_ADMIN)
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: {
        id: true,
        assignments: {
          where: { isPrimary: true, endDate: null, effectiveDate: { lte: new Date() } },
          take: 1,
          select: { companyId: true },
        },
      },
    })

    if (!employee) throw notFound('직원을 찾을 수 없습니다.')

    const primary = extractPrimaryAssignment(employee.assignments)
    const employeeCompanyId = primary?.companyId
    if (user.role !== 'SUPER_ADMIN' && employeeCompanyId !== user.companyId) {
      throw forbidden('다른 회사의 직원 정보에 접근할 수 없습니다.')
    }

    const yearParam = req.nextUrl.searchParams.get('year')
    const year = yearParam ? parseInt(yearParam, 10) : undefined

    const balances = await prisma.leaveYearBalance.findMany({
      where: {
        employeeId,
        ...(year ? { year } : {}),
      },
      include: {
        leaveTypeDef: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            code: true,
            category: true,
            isPaid: true,
          },
        },
      },
      orderBy: [{ year: 'desc' }, { createdAt: 'asc' }],
    })

    const result = balances.map(b => ({
      ...b,
      remaining: b.entitled + b.carriedOver + b.adjusted - b.used - b.pending,
    }))

    return apiSuccess(result)
  },
  perm(MODULE.LEAVE, ACTION.APPROVE),
)
