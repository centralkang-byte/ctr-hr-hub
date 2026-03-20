// ═══════════════════════════════════════════════════════════
// POST /api/v1/payroll/runs/[id]/calculate — 급여 계산 실행
// DRAFT | ATTENDANCE_CLOSED → CALCULATING → REVIEW
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, DOMESTIC_COMPANY_CODES } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { calculatePayrollRun } from '@/lib/payroll/batch'

export const POST = withPermission(
  async (req, context, user) => {
    const { id } = await context.params

    const run = await prisma.payrollRun.findFirst({
      where: { id, companyId: user.companyId },
    })

    if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')
    if (!['DRAFT', 'ATTENDANCE_CLOSED'].includes(run.status)) {
      throw badRequest('DRAFT 또는 ATTENDANCE_CLOSED 상태의 급여 실행만 계산할 수 있습니다.')
    }

    // GP#3: 해외법인 급여 계산 차단 — 로컬 시스템에서 처리
    const company = await prisma.company.findUnique({ where: { id: run.companyId }, select: { code: true } })
    if (!company || !(DOMESTIC_COMPANY_CODES as readonly string[]).includes(company.code)) {
      throw forbidden('해외법인은 로컬 시스템에서 급여를 처리합니다.')
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
