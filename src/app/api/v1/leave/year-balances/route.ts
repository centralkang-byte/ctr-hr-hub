// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Year Balances API (B6-2)
// GET /api/v1/leave/year-balances — 직원 연도별 휴가 잔여
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const yearParam = searchParams.get('year')
    const requestedId = searchParams.get('employeeId')
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()

    // IDOR 방어: perm(LEAVE.VIEW)는 EMPLOYEE도 보유하므로 임의 employeeId로 타인 잔액 조회가 가능했음.
    // 본인=항상 허용 / HR·SUPER·EXEC=회사 스코프 내 허용 / 그 외(MANAGER·EMPLOYEE)=본인만.
    let employeeId = user.employeeId ?? ''
    if (requestedId && requestedId !== user.employeeId) {
      const isPrivileged =
        user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN || user.role === ROLE.EXECUTIVE
      if (!isPrivileged) {
        throw forbidden('본인의 휴가 잔액만 조회할 수 있습니다.')
      }
      // 회사 스코프: SUPER_ADMIN 외에는 같은 법인 직원만 (쿼리에 회사 조건이 없어 별도 검증)
      if (user.role !== ROLE.SUPER_ADMIN) {
        const inCompany = await prisma.employee.findFirst({
          where: {
            id: requestedId,
            assignments: { some: { isPrimary: true, endDate: null, companyId: user.companyId } },
          },
          select: { id: true },
        })
        if (!inCompany) throw forbidden('해당 직원의 휴가 잔액을 조회할 권한이 없습니다.')
      }
      employeeId = requestedId
    }

    const balances = await prisma.leaveYearBalance.findMany({
      where: { employeeId, year },
      include: {
        leaveTypeDef: {
          select: { id: true, code: true, name: true, nameEn: true, isPaid: true, allowHalfDay: true, category: true, subcategory: true, displayOrder: true },
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
