// Complete 11-step Korean year-end tax settlement calculation
// Must export: calculateYearEndSettlement, sumAnnualGross, sumPrepaidTax, calcEarnedIncomeDeduction

import { prisma } from '@/lib/prisma'

export interface YearEndCalculationResult {
  totalSalary: bigint
  earnedIncomeDeduction: bigint
  earnedIncome: bigint
  totalIncomeDeduction: bigint
  taxableBase: bigint
  taxRate: number
  calculatedTax: bigint
  totalTaxCredit: bigint
  determinedTax: bigint
  prepaidTax: bigint
  finalSettlement: bigint       // positive = additional payment, negative = refund
  localTaxSettlement: bigint
}

/**
 * ① 연간 총급여 집계 (B7-1a payroll_items)
 * PayrollRun.yearMonth = 'YYYY-MM', status = 'APPROVED' | 'PAID'
 */
export async function sumAnnualGross(employeeId: string, year: number): Promise<bigint> {
  // Query payroll_items joined with payroll_runs where yearMonth starts with `year`
  const items = await prisma.payrollItem.findMany({
    where: {
      employeeId,
      run: {
        yearMonth: { startsWith: `${year}-` },
        status: { in: ['APPROVED', 'PAID'] },
      },
    },
    select: { grossPay: true },
  })
  return items.reduce((sum, item) => sum + BigInt(Math.round(Number(item.grossPay))), BigInt(0))
}

/**
 * ⑩ 기납부세액 집계 (B7-1a 원천징수 합산)
 * PayrollItem.detail.incomeTax (JSON field)
 */
export async function sumPrepaidTax(employeeId: string, year: number): Promise<bigint> {
  const items = await prisma.payrollItem.findMany({
    where: {
      employeeId,
      run: {
        yearMonth: { startsWith: `${year}-` },
        status: { in: ['APPROVED', 'PAID'] },
      },
    },
    select: { detail: true },
  })
  return items.reduce((sum, item) => {
    const detail = item.detail as Record<string, unknown> | null
    const tax = detail?.incomeTax as number | undefined
    return sum + BigInt(Math.round(tax ?? 0))
  }, BigInt(0))
}

/**
 * ② 근로소득공제 (총급여 구간별 — 2025년 기준)
 * https://www.nts.go.kr
 * - 500만 이하: 70%
 * - 500~1500만: 350만 + 40%
 * - 1500~4500만: 750만 + 15%
 * - 4500~1억: 1200만 + 5%
 * - 1억 초과: 2000만 (한도)
 */
export function calcEarnedIncomeDeduction(totalSalary: bigint): bigint {
  const s = Number(totalSalary)
  let deduction: number
  if (s <= 5_000_000) {
    deduction = s * 0.7
  } else if (s <= 15_000_000) {
    deduction = 3_500_000 + (s - 5_000_000) * 0.4
  } else if (s <= 45_000_000) {
    deduction = 7_500_000 + (s - 15_000_000) * 0.15
  } else if (s <= 100_000_000) {
    deduction = 12_000_000 + (s - 45_000_000) * 0.05
  } else {
    deduction = 20_000_000
  }
  return BigInt(Math.round(Math.min(deduction, 20_000_000)))
}

/**
 * ⑥⑦ 누진세율 적용
 */
function applyProgressiveTax(
  taxableBase: bigint,
  taxRates: { minAmount: bigint; maxAmount: bigint | null; rate: number; progressiveDeduction: bigint }[],
): { calculatedTax: bigint; appliedRate: number } {
  const base = Number(taxableBase)
  if (base <= 0) return { calculatedTax: BigInt(0), appliedRate: 0 }

  for (let i = taxRates.length - 1; i >= 0; i--) {
    const bracket = taxRates[i]
    if (base > Number(bracket.minAmount)) {
      const tax = Math.round(base * (bracket.rate / 100) - Number(bracket.progressiveDeduction))
      return { calculatedTax: BigInt(Math.max(0, tax)), appliedRate: bracket.rate }
    }
  }
  return { calculatedTax: BigInt(0), appliedRate: 0 }
}

/**
 * Main: 11단계 연말정산 계산
 * settlementId: 이미 생성된 YearEndSettlement.id
 */
export async function calculateYearEndSettlement(
  settlementId: string,
  employeeId: string,
  year: number,
): Promise<YearEndCalculationResult> {
  // ① 총급여
  const totalSalary = await sumAnnualGross(employeeId, year)

  // ② 근로소득공제
  const earnedIncomeDeduction = calcEarnedIncomeDeduction(totalSalary)

  // ③ 근로소득금액
  const earnedIncome = totalSalary - earnedIncomeDeduction

  // ④ 소득공제 합산
  const incomeDeductionItems = await prisma.yearEndDeduction.findMany({
    where: { settlementId, category: 'income_deduction' },
  })
  const totalIncomeDeduction = incomeDeductionItems.reduce(
    (sum, d) => sum + d.deductibleAmount,
    BigInt(0),
  )

  // ⑤ 과세표준
  const rawTaxableBase = earnedIncome - totalIncomeDeduction
  const taxableBase = rawTaxableBase < BigInt(0) ? BigInt(0) : rawTaxableBase

  // ⑥⑦ 세율 + 산출세액
  const taxRates = await prisma.incomeTaxRate.findMany({
    where: { year },
    orderBy: { minAmount: 'asc' },
  })
  const { calculatedTax, appliedRate } = applyProgressiveTax(taxableBase, taxRates)

  // ⑧ 세액공제 합산
  const taxCreditItems = await prisma.yearEndDeduction.findMany({
    where: { settlementId, category: 'tax_credit' },
  })
  const totalTaxCredit = taxCreditItems.reduce(
    (sum, c) => sum + c.deductibleAmount,
    BigInt(0),
  )

  // ⑨ 결정세액
  const rawDeterminedTax = calculatedTax - totalTaxCredit
  const determinedTax = rawDeterminedTax < BigInt(0) ? BigInt(0) : rawDeterminedTax

  // ⑩ 기납부세액
  const prepaidTax = await sumPrepaidTax(employeeId, year)

  // ⑪ 차감징수 (양수=추가납부, 음수=환급)
  const finalSettlement = determinedTax - prepaidTax
  const localTaxSettlement = BigInt(Math.round(Number(finalSettlement) * 0.1))

  return {
    totalSalary,
    earnedIncomeDeduction,
    earnedIncome,
    totalIncomeDeduction,
    taxableBase,
    taxRate: appliedRate,
    calculatedTax,
    totalTaxCredit,
    determinedTax,
    prepaidTax,
    finalSettlement,
    localTaxSettlement,
  }
}
