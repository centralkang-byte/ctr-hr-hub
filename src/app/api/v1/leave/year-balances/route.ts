// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Year Balances API (B6-2)
// GET /api/v1/leave/year-balances — 직원 연도별 휴가 잔여
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const yearParam = searchParams.get('year')
    const employeeId = searchParams.get('employeeId') ?? user.employeeId
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()

    const balances = await prisma.leaveYearBalance.findMany({
      where: { employeeId, year },
      include: {
        leaveTypeDef: {
          select: { id: true, code: true, name: true, isPaid: true, allowHalfDay: true },
        },
      },
      orderBy: [{ leaveTypeDef: { displayOrder: 'asc' } }, { leaveTypeDef: { name: 'asc' } }],
    })

    // remaining 계산 포함
    const result = balances.map((b) => ({
      ...b,
      remaining: b.entitled + b.carriedOver + b.adjusted - b.used - b.pending,
    }))

    return apiSuccess(result)
  },
  perm(MODULE.LEAVE, ACTION.VIEW),
)
