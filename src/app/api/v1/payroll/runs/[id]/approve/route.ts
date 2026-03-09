// ═══════════════════════════════════════════════════════════
// PUT /api/v1/payroll/runs/[id]/approve — 급여 승인 + 명세서 생성
// REVIEW → APPROVED + Payslip 자동 생성
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { eventBus, DOMAIN_EVENTS } from '@/lib/events'

export const PUT = withPermission(
  async (req, context, user) => {
    const { id } = await context.params

    const run = await prisma.payrollRun.findFirst({
      where: { id, companyId: user.companyId },
      include: { payrollItems: { select: { id: true, employeeId: true } } },
    })

    if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')
    if (run.status !== 'REVIEW') {
      throw badRequest('REVIEW 상태의 급여 실행만 승인할 수 있습니다.')
    }

    // yearMonth → year, month 파싱 (e.g. "2025-03")
    const [yearStr, monthStr] = run.yearMonth.split('-')
    const year  = parseInt(yearStr,  10)
    const month = parseInt(monthStr, 10)

    const ctx = { companyId: user.companyId, actorId: user.employeeId, occurredAt: new Date() }
    const eventPayload = {
      ctx,
      runId:          run.id,
      yearMonth:      run.yearMonth,
      year,
      month,
      payrollItemIds: run.payrollItems,
    }

    await prisma.$transaction(async (tx) => {
      // 1. 상태 → APPROVED
      await tx.payrollRun.update({
        where: { id },
        data: {
          status:     'APPROVED',
          approvedBy: user.employeeId,
          approvedAt: new Date(),
        },
      })

      // 2. Payslip 생성 + batch notification (handled by payrollApprovedHandler)
      await eventBus.publish(DOMAIN_EVENTS.PAYROLL_APPROVED, eventPayload, tx)
    })

    const updated = await prisma.payrollRun.findUniqueOrThrow({ where: { id } })

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId:      user.employeeId,
      action:       'PAYROLL_RUN_APPROVE',
      resourceType: 'PayrollRun',
      resourceId:   id,
      companyId:    user.companyId,
      changes:      { year, month, headcount: run.payrollItems.length },
      ip,
      userAgent,
    })

    // Fire-and-forget batch notifications (tx=undefined → handler sends notifications only)
    void eventBus.publish(DOMAIN_EVENTS.PAYROLL_APPROVED, eventPayload)

    return apiSuccess({ ...updated, payslipsCreated: run.payrollItems.length })
  },
  perm(MODULE.PAYROLL, ACTION.APPROVE),
)
