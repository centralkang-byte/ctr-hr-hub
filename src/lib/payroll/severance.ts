// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Severance (퇴직금) Calculator
// 퇴직금 = 최근 3개월 평균임금 × (재직일수/365) × 30
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { differenceInDays, subMonths, format, startOfMonth, endOfMonth } from 'date-fns'
import { calculateIncomeTax } from './kr-tax'
import type { SeveranceDetail } from './types'

export async function calculateSeverance(
  employeeId: string,
  terminationDate: Date,
): Promise<SeveranceDetail> {
  const employee = await prisma.employee.findUniqueOrThrow({
    where: { id: employeeId },
    select: {
      id: true,
      name: true,
      hireDate: true,
      companyId: true,
    },
  })

  const tenureDays = differenceInDays(terminationDate, employee.hireDate)
  const tenureYears = tenureDays / 365
  const isEligible = tenureDays >= 365

  // 최근 3개월 급여 데이터 조회
  const recentThreeMonths: SeveranceDetail['recentThreeMonths'] = []

  for (let i = 1; i <= 3; i++) {
    const monthDate = subMonths(terminationDate, i)
    const yearMonth = format(monthDate, 'yyyy-MM')
    const monthStart = startOfMonth(monthDate)
    const monthEnd = endOfMonth(monthDate)

    // PayrollItem에서 해당 월 데이터 조회
    const payrollItem = await prisma.payrollItem.findFirst({
      where: {
        employeeId,
        run: {
          companyId: employee.companyId,
          yearMonth,
          status: 'PAID',
        },
      },
    })

    if (payrollItem) {
      recentThreeMonths.push({
        yearMonth,
        baseSalary: Number(payrollItem.baseSalary),
        overtimePay: Number(payrollItem.overtimePay),
        allowances: Number(payrollItem.allowances),
        totalPay:
          Number(payrollItem.baseSalary) +
          Number(payrollItem.overtimePay) +
          Number(payrollItem.allowances),
      })
    } else {
      // PAID 기록이 없으면 CompensationHistory에서 추정
      const comp = await prisma.compensationHistory.findFirst({
        where: {
          employeeId,
          companyId: employee.companyId,
          effectiveDate: { lte: monthEnd },
        },
        orderBy: { effectiveDate: 'desc' },
      })

      const monthlySalary = comp ? Math.round(Number(comp.newBaseSalary) / 12) : 0

      // 해당 월 수당
      const allowanceRecords = await prisma.allowanceRecord.findMany({
        where: { employeeId, companyId: employee.companyId, yearMonth },
      })
      const totalAllowance = allowanceRecords.reduce(
        (sum, r) => sum + Number(r.amount),
        0,
      )

      // 해당 월 초과근무
      const attendances = await prisma.attendance.findMany({
        where: {
          employeeId,
          companyId: employee.companyId,
          workDate: { gte: monthStart, lte: monthEnd },
          overtimeMinutes: { gt: 0 },
        },
        select: { overtimeMinutes: true },
      })
      const totalOTMinutes = attendances.reduce(
        (sum, a) => sum + (a.overtimeMinutes ?? 0),
        0,
      )
      const hourlyWage = monthlySalary > 0 ? Math.round(monthlySalary / 209) : 0
      const otPay = Math.round(hourlyWage * 1.5 * (totalOTMinutes / 60))

      recentThreeMonths.push({
        yearMonth,
        baseSalary: monthlySalary,
        overtimePay: otPay,
        allowances: totalAllowance,
        totalPay: monthlySalary + otPay + totalAllowance,
      })
    }
  }

  // 3개월 평균임금
  const totalThreeMonths = recentThreeMonths.reduce((s, m) => s + m.totalPay, 0)
  const averageMonthlyPay = Math.round(totalThreeMonths / 3)

  // 퇴직금 = 평균임금 × (재직일수/365) × 30
  const severancePay = isEligible
    ? Math.round(averageMonthlyPay * (tenureDays / 365) * 30 / 30)
    : 0

  // 퇴직소득세 (간소화: 일반 소득세 기준 적용)
  const taxResult = isEligible ? calculateIncomeTax(severancePay) : { incomeTax: 0, localIncomeTax: 0 }

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    hireDate: employee.hireDate.toISOString(),
    terminationDate: terminationDate.toISOString(),
    tenureDays,
    tenureYears: Math.round(tenureYears * 100) / 100,
    isEligible,
    recentThreeMonths,
    averageMonthlyPay,
    severancePay,
    incomeTax: taxResult.incomeTax,
    localIncomeTax: taxResult.localIncomeTax,
    netSeverancePay: severancePay - taxResult.incomeTax - taxResult.localIncomeTax,
  }
}
