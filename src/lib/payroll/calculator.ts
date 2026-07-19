// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll Calculator
// 직원별 급여 상세 계산
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { getOvertimeRatesFromSettings } from '@/lib/labor/settings'
import { normalizeUtcDateOnly } from '@/lib/timezone'
import type { ResolvedPayrollCalculationPeriod } from './period'
import {
  calculateHourlyWage,
//   calculateTotalDeductions,
  calculateSocialInsurance,
  calculateIncomeTax,
  separateTaxableIncome,
  calculateProrated,
  detectPayrollAnomalies,
  getWeekdaysInMonth,
//   MONTHLY_STANDARD_HOURS,
} from './kr-tax'
import type { AllowanceItem } from './kr-tax'
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
  otRates?: { condition: string; multiplier: number }[],
): { pay: number; overtime: PayrollOvertime } {
  const findRate = (cond: string, fallback: number) =>
    otRates?.find((r) => r.condition === cond)?.multiplier ?? fallback

  const weekdayOTHours = breakdown.weekdayOTMinutes / 60
  const weekendHours = breakdown.weekendMinutes / 60
  const holidayHours = breakdown.holidayMinutes / 60
  const nightHours = breakdown.nightMinutes / 60

  // 연장근로 1.5x, 휴일 1.5x, 공휴일 2.0x, 야간 0.5x (가산분만)
  const weekdayOTPay = Math.round(hourlyWage * findRate('WEEKDAY_OT', 1.5) * weekdayOTHours)
  const weekendPay = Math.round(hourlyWage * findRate('WEEKEND', 1.5) * weekendHours)
  const holidayPay = Math.round(hourlyWage * findRate('HOLIDAY', 2.0) * holidayHours)
  const nightPay = Math.round(hourlyWage * findRate('NIGHT', 0.5) * nightHours)

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
  companyId: string,
  period: ResolvedPayrollCalculationPeriod,
): Promise<PayrollItemDetail> {
  const { periodStartDate, periodEndDate, year, month, yearMonth } = period

  // 1. 기본급: CompensationHistory 최신 레코드
  const latestComp = await prisma.compensationHistory.findFirst({
    where: {
      employeeId,
      companyId,
      effectiveDate: { lte: periodEndDate },
    },
    orderBy: { effectiveDate: 'desc' },
  })

  const annualSalary = latestComp ? Number(latestComp.newBaseSalary) : 0
  const monthlySalary = Math.round(annualSalary / 12)
//   const hourlyWage = calculateHourlyWage(monthlySalary)

  // 2. 초과근무: Attendance 기간 내 overtimeMinutes 합산
  // workDate is a UTC-midnight date-only value, not a clock instant.
  const attendances = await prisma.attendance.findMany({
    where: {
      employeeId,
      companyId,
      workDate: { gte: periodStartDate, lte: periodEndDate },
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

  // overtimePay와 overtime은 일할 기준 hourlyWage로 아래에서 재계산됨

  // 2-1. OT rates from Settings (company override → global → hardcoded fallback)
  const otConfig = await getOvertimeRatesFromSettings(companyId, 'KR')

  // 3. 수당: AllowanceRecord (해당 월)
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
        deletedAt: null,
        effectiveFrom: { lte: periodEndDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStartDate } }],
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

  // 4. 비과세 한도 로드
  const nontaxableLimitRows = await prisma.nontaxableLimit.findMany({
    where: { year, deletedAt: null },
  })
  const nontaxableLimitsMap: Record<string, number> = {}
  for (const row of nontaxableLimitRows) {
    nontaxableLimitsMap[row.code] = row.monthlyLimit
  }

  // 4-1. 비과세 분리를 위한 allowances 구성
  const allowanceItems: AllowanceItem[] = [
    { code: 'meal_allowance', name: '식대', amount: mealAllowance, isTaxable: false },
    { code: 'vehicle_allowance', name: '차량유지비', amount: transportAllowance, isTaxable: false },
    { code: 'overtime_allowance', name: '고정초과근무수당', amount: fixedOvertimeAllowance, isTaxable: true },
    { code: 'other', name: '기타수당', amount: otherEarnings, isTaxable: true },
  ]

  // 5. 중도입사/퇴사 일할계산
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { hireDate: true },
  })

  // hireDate is also a UTC-midnight date-only value.
  const hireDate = employee?.hireDate
    ? normalizeUtcDateOnly(employee.hireDate)
    : undefined
  const prorateResult = calculateProrated(monthlySalary, year, month, hireDate, undefined)

  const effectiveMonthlySalary = prorateResult.proratedAmount
  const effectiveHourlyWage = calculateHourlyWage(effectiveMonthlySalary)

  // 초과근무도 일할 적용 시 hourlyWage를 일할 기준으로 재계산
  const { pay: effectiveOvertimePay, overtime } = calculateOvertimePay(effectiveHourlyWage, overtimeBreakdown, otConfig.rates)

  // ─── GP#2 Gap 1: 무급휴가 공제 ─────────────────────────────
  // 기간 내 승인된 무급 LeaveRequest 합산 (policy.isPaid = false)
  const unpaidLeaveRequests = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      companyId,
      status: 'APPROVED',
      startDate: { lte: periodEndDate },
      endDate: { gte: periodStartDate },
      policy: { isPaid: false },
    },
    select: { days: true },
  })
  const unpaidLeaveDays = unpaidLeaveRequests.reduce((sum, r) => sum + Number(r.days), 0)

  // 월 근무일 기준 일일 급여 → 무급휴가 공제액
  const workingDaysInMonth = getWeekdaysInMonth(year, month)
  const dailyWage = workingDaysInMonth > 0 ? Math.round(effectiveMonthlySalary / workingDaysInMonth) : 0
  const unpaidLeaveDeduction = Math.round(dailyWage * unpaidLeaveDays)

  // ─── GP#2 Gap 2: 결근 공제 ──────────────────────────────────
  // 승인된 휴가일(leaveDate set)을 제외한 순수 결근일 수
  // 1) 기간 내 ABSENT 근태 레코드 수집
  const absentRecords = await prisma.attendance.findMany({
    where: {
      employeeId,
      companyId,
      workDate: { gte: periodStartDate, lte: periodEndDate },
      status: 'ABSENT',
    },
    select: { workDate: true },
  })

  // 2) 기간 내 승인된 유급/무급 휴가 날짜 Set → 이중 공제 방지
  const approvedLeaveReqs = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      companyId,
      status: 'APPROVED',
      startDate: { lte: periodEndDate },
      endDate: { gte: periodStartDate },
    },
    select: { startDate: true, endDate: true },
  })

  // 승인된 휴가 기간의 날짜 Set 구성 (YYYY-MM-DD 문자열)
  const leaveDateSet = new Set<string>()
  for (const lr of approvedLeaveReqs) {
    const cur = new Date(lr.startDate)
    const end = new Date(lr.endDate)
    cur.setUTCHours(0, 0, 0, 0)
    end.setUTCHours(0, 0, 0, 0)
    while (cur <= end) {
      leaveDateSet.add(cur.toISOString().slice(0, 10))
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
  }

  // 3) 휴가가 없는 순수 결근일만 카운트
  const absentDays = absentRecords.filter((rec) => {
    const dateKey = new Date(rec.workDate).toISOString().slice(0, 10)
    return !leaveDateSet.has(dateKey)
  }).length

  const absentDeduction = Math.round(dailyWage * absentDays)

  // ─── 총 공제 항목 구성 ────────────────────────────────────
  const workforceDedItems = []
  if (unpaidLeaveDeduction > 0) {
    workforceDedItems.push({ code: 'unpaid_leave', name: '무급휴가 공제', amount: unpaidLeaveDeduction, category: 'DEDUCTION' })
  }
  if (absentDeduction > 0) {
    workforceDedItems.push({ code: 'absent_deduction', name: '결근 공제', amount: absentDeduction, category: 'DEDUCTION' })
  }
  const totalWorkforceDeduction = unpaidLeaveDeduction + absentDeduction

  // 6. 비과세 분리 (무급/결근 공제 후 기본급 기준)
  const adjustedBaseSalary = Math.max(0, effectiveMonthlySalary - totalWorkforceDeduction)
  const { taxableIncome, nontaxableTotal } = separateTaxableIncome(
    adjustedBaseSalary,
    effectiveOvertimePay,
    allowanceItems,
    nontaxableLimitsMap,
  )

  const totalAllowances = mealAllowance + transportAllowance + fixedOvertimeAllowance + otherEarnings
  const grossPay = adjustedBaseSalary + effectiveOvertimePay + totalAllowances

  const earnings: PayrollEarnings = {
    baseSalary: adjustedBaseSalary,
    fixedOvertimeAllowance,
    mealAllowance,
    transportAllowance,
    overtimePay: effectiveOvertimePay,
    nightShiftPay: 0,
    holidayPay: 0,
    bonuses: 0,
    otherEarnings,
  }

  // 7. 4대보험 공제 (과세소득 기준)
  const socialInsurance = calculateSocialInsurance(taxableIncome)

  // 8. 소득세
  const incomeTax = calculateIncomeTax(taxableIncome)

  const totalDeductions = socialInsurance.total + incomeTax.total
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

  // 9. 이상 항목 감지 (전월 PayrollItem 참조)
  const prevYearMonth =
    month === 1
      ? `${year - 1}-12`
      : `${year}-${String(month - 1).padStart(2, '0')}`

  const prevItems = await prisma.payrollItem.findMany({
    where: {
      employeeId,
      run: { companyId, yearMonth: prevYearMonth, status: { in: ['APPROVED', 'PAID'] } },
    },
    take: 1,
  })
  const prevItem = prevItems[0]

  const anomalies = detectPayrollAnomalies(
    {
      grossPay,
      overtimePay: effectiveOvertimePay,
      baseSalary: effectiveMonthlySalary,
      isProrated: prorateResult.isProrated,
    },
    prevItem ? { grossPay: Number(prevItem.grossPay) } : null,
  )

  return {
    earnings,
    deductions,
    overtime,
    grossPay,
    totalDeductions,
    netPay,
    nontaxableTotal,
    taxableIncome,
    isProrated: prorateResult.isProrated,
    prorateRatio: prorateResult.ratio,
    workDays: prorateResult.workDays,
    anomalies,
    customDeductions: workforceDedItems.length > 0 ? workforceDedItems : undefined,
    unpaidLeaveDays: unpaidLeaveDays > 0 ? unpaidLeaveDays : undefined,
    absentDays: absentDays > 0 ? absentDays : undefined,
  }
}
