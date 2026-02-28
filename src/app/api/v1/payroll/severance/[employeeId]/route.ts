// ═══════════════════════════════════════════════════════════
// POST /api/v1/payroll/severance/[employeeId] — 퇴직금 계산
// ═══════════════════════════════════════════════════════════

import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { payrollSeveranceSchema } from '@/lib/schemas/payroll'
import { calculateSeverance } from '@/lib/payroll/severance'

export const POST = withPermission(
  async (req, context, _user) => {
    const { employeeId } = await context.params
    const body = await req.json()
    const { terminationDate } = payrollSeveranceSchema.parse(body)

    const result = await calculateSeverance(employeeId, new Date(terminationDate))

    return apiSuccess(result)
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)
