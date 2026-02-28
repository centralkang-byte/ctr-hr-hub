// ═══════════════════════════════════════════════════════════
// PUT /api/v1/payroll/runs/[id]/items/[itemId] — 수동 조정
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { payrollItemAdjustSchema } from '@/lib/schemas/payroll'
import { calculateTotalDeductions } from '@/lib/payroll/kr-tax'

export const PUT = withPermission(
  async (req, context, user) => {
    const { id, itemId } = await context.params

    // 급여 실행 상태 확인
    const run = await prisma.payrollRun.findFirst({
      where: { id, companyId: user.companyId },
    })

    if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')
    if (run.status !== 'REVIEW') {
      throw badRequest('REVIEW 상태에서만 항목을 수정할 수 있습니다.')
    }

    const item = await prisma.payrollItem.findFirst({
      where: { id: itemId, runId: id },
    })

    if (!item) throw notFound('급여 항목을 찾을 수 없습니다.')

    const body = await req.json()
    const adjustData = payrollItemAdjustSchema.parse(body)

    // 조정된 값으로 재계산
    const baseSalary = adjustData.baseSalary ?? Number(item.baseSalary)
    const overtimePay = adjustData.overtimePay ?? Number(item.overtimePay)
    const bonus = adjustData.bonus ?? Number(item.bonus)
    const allowances = adjustData.allowances ?? Number(item.allowances)
    const grossPay = baseSalary + overtimePay + bonus + allowances

    const { totalDeductions } = calculateTotalDeductions(grossPay)
    const manualDeductions = adjustData.deductions ?? totalDeductions
    const netPay = grossPay - manualDeductions

    const updated = await prisma.payrollItem.update({
      where: { id: itemId },
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

    // PayrollRun 총계 재계산
    const allItems = await prisma.payrollItem.findMany({
      where: { runId: id },
    })

    const totals = allItems.reduce(
      (acc, i) => ({
        gross: acc.gross + Number(i.grossPay),
        deductions: acc.deductions + Number(i.deductions),
        net: acc.net + Number(i.netPay),
      }),
      { gross: 0, deductions: 0, net: 0 },
    )

    await prisma.payrollRun.update({
      where: { id },
      data: {
        totalGross: totals.gross,
        totalDeductions: totals.deductions,
        totalNet: totals.net,
      },
    })

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'PAYROLL_ITEM_ADJUST',
      resourceType: 'PayrollItem',
      resourceId: itemId,
      companyId: user.companyId,
      changes: { ...adjustData, grossPay, netPay },
      ip,
      userAgent,
    })

    return apiSuccess(updated)
  },
  perm(MODULE.PAYROLL, ACTION.UPDATE),
)
