import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/leave/balances/[employeeId] ─────────────
// Employee's leave balances (HR view)

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
      select: { id: true, companyId: true },
    })

    if (!employee) throw notFound('직원을 찾을 수 없습니다.')

    if (user.role !== 'SUPER_ADMIN' && employee.companyId !== user.companyId) {
      throw forbidden('다른 회사의 직원 정보에 접근할 수 없습니다.')
    }

    const yearParam = req.nextUrl.searchParams.get('year')
    const year = yearParam ? parseInt(yearParam, 10) : undefined

    const balances = await prisma.employeeLeaveBalance.findMany({
      where: {
        employeeId,
        ...(year ? { year } : {}),
      },
      include: {
        policy: {
          select: {
            id: true,
            name: true,
            leaveType: true,
            isPaid: true,
          },
        },
      },
      orderBy: [{ year: 'desc' }, { createdAt: 'asc' }],
    })

    return apiSuccess(balances)
  },
  perm(MODULE.LEAVE, ACTION.APPROVE),
)
