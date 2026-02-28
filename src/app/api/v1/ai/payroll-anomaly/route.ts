// ═══════════════════════════════════════════════════════════
// POST /api/v1/ai/payroll-anomaly — AI 급여 이상감지
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'
import { payrollAnomalySchema } from '@/lib/schemas/payroll'
import { payrollAnomalyCheck } from '@/lib/payroll/ai-anomaly'

export const POST = withPermission(
  async (req, _context, user) => {
    const body = await req.json()
    const { runId } = payrollAnomalySchema.parse(body)

    const run = await prisma.payrollRun.findFirst({
      where: { id: runId, companyId: user.companyId },
      include: {
        payrollItems: {
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                hireDate: true,
                resignDate: true,
              },
            },
          },
        },
      },
    })

    if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')

    const result = await payrollAnomalyCheck(run, user.companyId, user.employeeId)

    return apiSuccess(result)
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)
