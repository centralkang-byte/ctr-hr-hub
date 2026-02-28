// ═══════════════════════════════════════════════════════════
// PUT /api/v1/payroll/runs/[id]/paid — 지급완료 처리
// APPROVED → PAID
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'

export const PUT = withPermission(
  async (req, context, user) => {
    const { id } = await context.params

    const run = await prisma.payrollRun.findFirst({
      where: { id, companyId: user.companyId },
    })

    if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')
    if (run.status !== 'APPROVED') {
      throw badRequest('APPROVED 상태의 급여 실행만 지급완료 처리할 수 있습니다.')
    }

    const updated = await prisma.payrollRun.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    })

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'PAYROLL_RUN_PAID',
      resourceType: 'PayrollRun',
      resourceId: id,
      companyId: user.companyId,
      ip,
      userAgent,
    })

    return apiSuccess(updated)
  },
  perm(MODULE.PAYROLL, ACTION.APPROVE),
)
