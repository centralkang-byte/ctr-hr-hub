// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/employees/[id]/histories
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiPaginated, buildPagination } from '@/lib/api'
import { notFound, badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { paginationSchema } from '@/lib/schemas/common'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/employees/[id]/histories ─────────────────

export const GET = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    // Verify the employee belongs to the user's company before returning histories
    const employee = await prisma.employee.findFirst({
      where: { id, deletedAt: null, ...companyFilter },
      select: { id: true },
    })
    if (!employee) throw notFound('직원을 찾을 수 없습니다.')

    const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = paginationSchema.safeParse(rawParams)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit } = parsed.data

    const [histories, total] = await Promise.all([
      prisma.employeeHistory.findMany({
        where: { employeeId: id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          fromDept: { select: { id: true, name: true } },
          toDept: { select: { id: true, name: true } },
          fromGrade: { select: { id: true, name: true } },
          toGrade: { select: { id: true, name: true } },
          approver: { select: { id: true, name: true } },
        },
      }),
      prisma.employeeHistory.count({ where: { employeeId: id } }),
    ])

    return apiPaginated(histories, buildPagination(page, limit, total))
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
