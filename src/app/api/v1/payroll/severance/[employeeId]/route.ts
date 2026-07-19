// ═══════════════════════════════════════════════════════════
// POST /api/v1/payroll/severance/[employeeId] — 퇴직금 계산
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { payrollSeveranceSchema } from '@/lib/schemas/payroll'
import { calculateSeverance } from '@/lib/payroll/severance'

export const POST = withPermission(
  async (req, context, user) => {
    const { employeeId } = await context.params

    let body: unknown
    try {
      body = await req.json()
    } catch {
      throw badRequest('요청 본문이 올바른 JSON 형식이 아닙니다.')
    }

    const parsed = payrollSeveranceSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.')
    }

    const terminationDateObj = new Date(parsed.data.terminationDate)
    if (Number.isNaN(terminationDateObj.getTime())) {
      throw badRequest('유효한 날짜 형식이 아닙니다.')
    }

    // Multi-tenant scope follows the assignment effective on the requested
    // termination date, not whichever assignment happens to be open today.
    const emp = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        ...(user.role !== ROLE.SUPER_ADMIN
          ? {
              assignments: {
                some: {
                  companyId: user.companyId,
                  isPrimary: true,
                  effectiveDate: { lte: terminationDateObj },
                  OR: [
                    { endDate: null },
                    { endDate: { gt: terminationDateObj } },
                  ],
                },
              },
            }
          : {}),
      },
      select: { id: true },
    })
    if (!emp) throw notFound('직원을 찾을 수 없습니다.')

    try {
      const result = await calculateSeverance(
        employeeId,
        terminationDateObj,
        user.role === ROLE.SUPER_ADMIN ? undefined : user.companyId,
      )
      return apiSuccess(result)
    } catch (err) {
      // findUniqueOrThrow → P2025 → notFound; other Prisma errors → handlePrismaError
      throw handlePrismaError(err)
    }
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)
