// ═══════════════════════════════════════════════════════════
// POST /api/v1/payroll/runs/[id]/calculate — 급여 계산 실행
// DRAFT → CALCULATING → REVIEW
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { calculatePayrollRun } from '@/lib/payroll/batch'

export const POST = withPermission(
  async (req, context, user) => {
    const { id } = await context.params

    const run = await prisma.payrollRun.findFirst({
      where: { id, companyId: user.companyId },
    })

    if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')
    if (run.status !== 'DRAFT') {
      throw badRequest('DRAFT 상태의 급여 실행만 계산할 수 있습니다.')
    }

    await calculatePayrollRun(id)

    const updated = await prisma.payrollRun.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { payrollItems: true } } },
    })

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'PAYROLL_RUN_CALCULATE',
      resourceType: 'PayrollRun',
      resourceId: id,
      companyId: user.companyId,
      changes: { headcount: updated.headcount },
      ip,
      userAgent,
    })

    return apiSuccess(updated)
  },
  perm(MODULE.PAYROLL, ACTION.UPDATE),
)
