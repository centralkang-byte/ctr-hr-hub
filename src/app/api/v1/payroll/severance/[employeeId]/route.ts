// ═══════════════════════════════════════════════════════════
// POST /api/v1/payroll/severance/[employeeId] — 퇴직금 계산
// ═══════════════════════════════════════════════════════════

import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { payrollSeveranceSchema } from '@/lib/schemas/payroll'
import { calculateSeverance } from '@/lib/payroll/severance'

export const POST = withPermission(
  async (req, context, _user) => {
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

    try {
      const result = await calculateSeverance(employeeId, terminationDateObj)
      return apiSuccess(result)
    } catch (err) {
      // findUniqueOrThrow → P2025 → notFound; other Prisma errors → handlePrismaError
      throw handlePrismaError(err)
    }
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)
