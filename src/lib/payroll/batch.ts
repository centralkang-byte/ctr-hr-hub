// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll Batch Calculation
// PayrollRun 일괄 계산 (DRAFT → CALCULATING → REVIEW)
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { calculatePayrollForEmployee } from './calculator'
import type { PayrollItemDetail } from './types'

const CONCURRENCY = 10

// ─── 병렬 처리 유틸 ─────────────────────────────────────

async function processInBatches<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(fn))
    results.push(...batchResults)
  }
  return results
}

// ─── Main Batch Calculator ──────────────────────────────

export async function calculatePayrollRun(runId: string): Promise<void> {
  // 1. PayrollRun 조회 & 상태 검증
  const run = await prisma.payrollRun.findUniqueOrThrow({
    where: { id: runId },
  })

  if (run.status !== 'DRAFT') {
    throw new Error(`급여 실행 상태가 DRAFT가 아닙니다: ${run.status}`)
  }

  // 2. status → CALCULATING
  await prisma.payrollRun.update({
    where: { id: runId },
    data: { status: 'CALCULATING' },
  })

  try {
    // 3. ACTIVE 직원 조회
    const employees = await prisma.employee.findMany({
      where: {
        companyId: run.companyId,
        status: 'ACTIVE',
        hireDate: { lte: run.periodEnd },
      },
      select: { id: true },
    })

    // 4. 병렬 계산
    const results = await processInBatches(
      employees,
      CONCURRENCY,
      async (emp) => {
        const detail = await calculatePayrollForEmployee(
          emp.id,
          run.periodStart,
          run.periodEnd,
          run.companyId,
        )
        return { employeeId: emp.id, detail }
      },
    )

    // 5. PayrollItem upsert ($transaction)
    let totalGross = 0
    let totalDeductions = 0
    let totalNet = 0

    await prisma.$transaction(
      results.map(({ employeeId, detail }: { employeeId: string; detail: PayrollItemDetail }) => {
        totalGross += detail.grossPay
        totalDeductions += detail.totalDeductions
        totalNet += detail.netPay

        return prisma.payrollItem.upsert({
          where: {
            id: `${runId}-${employeeId}`,
          },
          create: {
            id: `${runId}-${employeeId}`,
            runId,
            employeeId,
            baseSalary: detail.earnings.baseSalary,
            overtimePay: detail.earnings.overtimePay,
            bonus: detail.earnings.bonuses,
            allowances:
              detail.earnings.mealAllowance +
              detail.earnings.transportAllowance +
              detail.earnings.fixedOvertimeAllowance +
              detail.earnings.otherEarnings,
            grossPay: detail.grossPay,
            deductions: detail.totalDeductions,
            netPay: detail.netPay,
            currency: 'KRW',
            detail: JSON.parse(JSON.stringify(detail)),
          },
          update: {
            baseSalary: detail.earnings.baseSalary,
            overtimePay: detail.earnings.overtimePay,
            bonus: detail.earnings.bonuses,
            allowances:
              detail.earnings.mealAllowance +
              detail.earnings.transportAllowance +
              detail.earnings.fixedOvertimeAllowance +
              detail.earnings.otherEarnings,
            grossPay: detail.grossPay,
            deductions: detail.totalDeductions,
            netPay: detail.netPay,
            detail: JSON.parse(JSON.stringify(detail)),
            isManuallyAdjusted: false,
            adjustmentReason: null,
          },
        })
      }),
    )

    // 6. PayrollRun 총계 업데이트 + status → REVIEW
    await prisma.payrollRun.update({
      where: { id: runId },
      data: {
        totalGross,
        totalDeductions,
        totalNet,
        headcount: employees.length,
        status: 'REVIEW',
      },
    })
  } catch (error) {
    // 실패 시 DRAFT로 복귀
    await prisma.payrollRun.update({
      where: { id: runId },
      data: { status: 'DRAFT' },
    })
    throw error
  }
}
