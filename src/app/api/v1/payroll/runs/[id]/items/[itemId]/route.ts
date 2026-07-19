// ═══════════════════════════════════════════════════════════
// PUT /api/v1/payroll/runs/[id]/items/[itemId] — 수동 조정
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { notFound, forbidden } from '@/lib/errors'
import { extractRequestMeta } from '@/lib/audit'
import { payrollItemAdjustSchema } from '@/lib/schemas/payroll'
import { calculateTotalDeductions } from '@/lib/payroll/kr-tax'
import {
  readPayrollItemAggregate,
  updatePayrollRunInPhase,
  withLockedPayrollRunPhase,
} from '@/lib/payroll/phase-writer-service'

export const PUT = withPermission(
  async (req, context, user) => {
    const { id, itemId } = await context.params

    // 급여 실행 상태 확인
    const candidate = await prisma.payrollRun.findUnique({
      where: { id },
      select: { id: true, companyId: true, yearMonth: true },
    })

    if (!candidate) throw notFound('급여 실행을 찾을 수 없습니다.')
    // 멀티테넌트 가드: SUPER_ADMIN 외에는 본인 법인만 (소유권 우선 — status 체크 앞)
    if (user.role !== ROLE.SUPER_ADMIN && candidate.companyId !== user.companyId) {
      throw forbidden('다른 법인의 급여 실행에 접근할 수 없습니다.')
    }

    const body = await req.json()
    const adjustData = payrollItemAdjustSchema.parse(body)
    const { ip, userAgent } = extractRequestMeta(req.headers)
    const updated = await withLockedPayrollRunPhase({
      candidate,
      expectedStatus: 'REVIEW',
      operation: 'payroll-item-edit',
      statusError: 'REVIEW 상태에서만 항목을 수정할 수 있습니다.',
      mutate: async (tx, run) => {
        const item = await tx.payrollItem.findFirst({
          where: { id: itemId, runId: id },
        })
        if (!item) throw notFound('급여 항목을 찾을 수 없습니다.')

        const baseSalary = adjustData.baseSalary ?? Number(item.baseSalary)
        const overtimePay = adjustData.overtimePay ?? Number(item.overtimePay)
        const bonus = adjustData.bonus ?? Number(item.bonus)
        const allowances = adjustData.allowances ?? Number(item.allowances)
        const grossPay = baseSalary + overtimePay + bonus + allowances
        const { totalDeductions } = calculateTotalDeductions(grossPay)
        const manualDeductions = adjustData.deductions ?? totalDeductions
        const netPay = grossPay - manualDeductions

        const payrollItem = await tx.payrollItem.update({
          where: { id: item.id },
          data: {
            baseSalary,
            overtimePay,
            bonus,
            allowances,
            grossPay,
            deductions: manualDeductions,
            netPay,
            isManuallyAdjusted: true,
            adjustmentReason: adjustData.adjustmentReason,
          },
        })
        const aggregate = await readPayrollItemAggregate(tx, id)
        await updatePayrollRunInPhase(tx, run, 'REVIEW', aggregate)
        await tx.auditLog.create({
          data: {
            actorId: user.employeeId,
            action: 'PAYROLL_ITEM_ADJUST',
            resourceType: 'PayrollItem',
            resourceId: itemId,
            companyId: run.companyId,
            changes: JSON.parse(
              JSON.stringify({ ...adjustData, grossPay, netPay }),
            ),
            ipAddress: ip ?? null,
            userAgent: userAgent ?? null,
          },
        })
        return payrollItem
      },
    })

    return apiSuccess(updated)
  },
  perm(MODULE.PAYROLL, ACTION.UPDATE),
)
