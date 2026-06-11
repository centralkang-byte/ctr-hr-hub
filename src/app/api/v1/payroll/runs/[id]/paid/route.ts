// ═══════════════════════════════════════════════════════════
// PUT /api/v1/payroll/runs/[id]/paid — 지급완료 처리
// APPROVED → PAID
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'

export const PUT = withPermission(
  async (req, context, user) => {
    const { id } = await context.params

    const run = await prisma.payrollRun.findUnique({ where: { id } })

    if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')
    // 멀티테넌트 가드: SUPER_ADMIN 외에는 본인 법인만 (소유권 우선 — status 체크 앞)
    if (user.role !== ROLE.SUPER_ADMIN && run.companyId !== user.companyId) {
      throw forbidden('다른 법인의 급여 실행에 접근할 수 없습니다.')
    }
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
      companyId: run.companyId,
      ip,
      userAgent,
    })

    return apiSuccess(updated)
  },
  perm(MODULE.PAYROLL, ACTION.APPROVE),
)
