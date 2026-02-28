// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll Calculator
// 직원별 급여 상세 계산
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { laborConfig } from '@/lib/labor/kr'
import {
  calculateHourlyWage,
  calculateTotalDeductions,
  MONTHLY_STANDARD_HOURS,
} from './kr-tax'
import type { PayrollItemDetail, PayrollEarnings, PayrollOvertime } from './types'

// ─── Overtime Calculation ───────────────────────────────

interface OvertimeBreakdown {
  weekdayOTMinutes: number
  weekendMinutes: number
  holidayMinutes: number
  nightMinutes: number
}

function calculateOvertimePay(
  hourlyWage: number,
  breakdown: OvertimeBreakdown,
): { pay: number; overtime: PayrollOvertime } {
  const rates = laborConfig.overtime_rates

  const weekdayOTHours = breakdown.weekdayOTMinutes / 60
  const weekendHours = breakdown.weekendMinutes / 60
  const holidayHours = breakdown.holidayMinutes / 60
  const nightHours = breakdown.nightMinutes / 60

  // 연장근로 1.5x, 휴일 1.5x, 공휴일 2.0x, 야간 0.5x (가산분만)
  const weekdayOTPay = Math.round(hourlyWage * (rates[0]?.multiplier ?? 1.5) * weekdayOTHours)
  const weekendPay = Math.round(hourlyWage * (rates[1]?.multiplier ?? 1.5) * weekendHours)
  const holidayPay = Math.round(hourlyWage * (rates[2]?.multiplier ?? 2.0) * holidayHours)
  const nightPay = Math.round(hourlyWage * (rates[3]?.multiplier ?? 0.5) * nightHours)

  const totalOvertimeHours = weekdayOTHours + weekendHours + holidayHours + nightHours

  return {
    pay: weekdayOTPay + weekendPay + holidayPay + nightPay,
    overtime: {
      hourlyWage,
      totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
      weekdayOTHours: Math.round(weekdayOTHours * 100) / 100,
      weekendHours: Math.round(weekendHours * 100) / 100,
      holidayHours: Math.round(holidayHours * 100) / 100,
      nightHours: Math.round(nightHours * 100) / 100,
    },
  }
}

// ─── Main Calculator ────────────────────────────────────

export async function calculatePayrollForEmployee(
  employeeId: string,
  periodStart: Date,
  periodEnd: Date,
  companyId: string,
): Promise<PayrollItemDetail> {
  // 1. 기본급: CompensationHistory 최신 레코드
  const latestComp = await prisma.compensationHistory.findFirst({
    where: {
      employeeId,
      companyId,
      effectiveDate: { lte: periodEnd },
    },
    orderBy: { effectiveDate: 'desc' },
  })

  const annualSalary = latestComp ? Number(latestComp.newBaseSalary) : 0
  const monthlySalary = Math.round(annualSalary / 12)
  const hourlyWage = calculateHourlyWage(monthlySalary)

  // 2. 초과근무: Attendance 기간 내 overtimeMinutes 합산
  const attendances = await prisma.attendance.findMany({
    where: {
      employeeId,
      companyId,
      workDate: { gte: periodStart, lte: periodEnd },
      overtimeMinutes: { gt: 0 },
    },
    select: {
      overtimeMinutes: true,
      workType: true,
    },
  })

  // WorkType별 분류
  const overtimeBreakdown: OvertimeBreakdown = {
    weekdayOTMinutes: 0,
    weekendMinutes: 0,
    holidayMinutes: 0,
    nightMinutes: 0,
  }

  for (const att of attendances) {
    const minutes = att.overtimeMinutes ?? 0
    switch (att.workType) {
      case 'HOLIDAY':
        overtimeBreakdown.holidayMinutes += minutes
        break
      case 'NIGHT':
        overtimeBreakdown.nightMinutes += minutes
        break
      case 'OVERTIME':
      default:
        overtimeBreakdown.weekdayOTMinutes += minutes
    }
  }

  const { pay: overtimePay, overtime } = calculateOvertimePay(hourlyWage, overtimeBreakdown)

  // 3. 수당: AllowanceRecord (해당 월)
  const yearMonth = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}`

  const allowanceRecords = await prisma.allowanceRecord.findMany({
    where: {
      employeeId,
      companyId,
      yearMonth,
    },
  })

  let mealAllowance = 0
  let transportAllowance = 0
  let otherEarnings = 0
  let fixedOvertimeAllowance = 0

  for (const ar of allowanceRecords) {
    const amount = Number(ar.amount)
    switch (ar.allowanceType) {
      case 'MEAL_ALLOWANCE':
        mealAllowance += amount
        break
      case 'TRANSPORT_ALLOWANCE':
        transportAllowance += amount
        break
      case 'OVERTIME_ALLOWANCE':
        fixedOvertimeAllowance += amount
        break
      default:
        otherEarnings += amount
    }
  }

  // BenefitPolicy MONTHLY 자동 수당
  const employeeBenefits = await prisma.employeeBenefit.findMany({
    where: {
      employeeId,
      status: 'ACTIVE',
      policy: {
        companyId,
        frequency: 'MONTHLY',
        isActive: true,
        effectiveFrom: { lte: periodEnd },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStart } }],
      },
    },
    include: { policy: true },
  })

  for (const eb of employeeBenefits) {
    const amount = Number(eb.policy.amount ?? 0)
    switch (eb.policy.category) {
      case 'MEAL':
        mealAllowance += amount
        break
      case 'TRANSPORT':
        transportAllowance += amount
        break
      default:
        otherEarnings += amount
    }
  }

  // 4. 총 지급액 계산
  const totalAllowances = mealAllowance + transportAllowance + fixedOvertimeAllowance + otherEarnings
  const earnings: PayrollEarnings = {
    baseSalary: monthlySalary,
    fixedOvertimeAllowance,
    mealAllowance,
    transportAllowance,
    overtimePay,
    nightShiftPay: 0,
    holidayPay: 0,
    bonuses: 0,
    otherEarnings,
  }

  const grossPay = monthlySalary + overtimePay + totalAllowances

  // 5. 공제 계산
  const { socialInsurance, incomeTax, totalDeductions } = calculateTotalDeductions(grossPay)

  const deductions = {
    nationalPension: socialInsurance.nationalPension,
    healthInsurance: socialInsurance.healthInsurance,
    longTermCare: socialInsurance.longTermCare,
    employmentInsurance: socialInsurance.employmentInsurance,
    incomeTax: incomeTax.incomeTax,
    localIncomeTax: incomeTax.localIncomeTax,
    otherDeductions: 0,
  }

  const netPay = grossPay - totalDeductions

  return {
    earnings,
    deductions,
    overtime,
    grossPay,
    totalDeductions,
    netPay,
  }
}
