import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/leave/balances ──────────────────────────
// My leave balances (employee view, current year)

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const yearParam = req.nextUrl.searchParams.get('year')
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()

    const balances = await prisma.employeeLeaveBalance.findMany({
      where: {
        employeeId: user.employeeId,
        year,
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
      orderBy: { createdAt: 'asc' },
    })

    return apiSuccess(balances)
  },
  perm(MODULE.LEAVE, ACTION.VIEW),
)
