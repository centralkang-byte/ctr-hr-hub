// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Negative Balance Settlement (퇴사 시 마이너스 정산)
// src/lib/leave/negative-balance-settlement.ts
//
// F-3: Calculates monetary deduction for negative leave balance
//   - Called by GP#2 offboarding settlement process
//   - Uses country-specific daily wage rate
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

export interface NegativeSettlement {
  employeeId: string
  deductionDays: number
  dailyRate: number
  deductionAmount: number
  details: Array<{
    policyName: string
    negativeDays: number
    amount: number
  }>
}

/**
 * Calculate negative balance deduction for an employee (used at resignation).
 * Returns null if no negative balance exists.
 */
export async function calculateNegativeBalanceDeduction(
  employeeId: string,
): Promise<NegativeSettlement | null> {
  const currentYear = new Date().getFullYear()

  // 1. Get all leave balances for current year
  const balances = await prisma.employeeLeaveBalance.findMany({
    where: { employeeId, year: currentYear },
    include: {
      policy: { select: { name: true } },
    },
  })

  // 2. Calculate total negative balance
  const negativeDetails: Array<{
    policyName: string
    negativeDays: number
    amount: number
  }> = []

  let totalNegativeDays = 0

  for (const balance of balances) {
    const remaining =
      Number(balance.grantedDays) +
      Number(balance.carryOverDays) -
      Number(balance.usedDays)

    if (remaining < 0) {
      const negativeDays = Math.abs(remaining)
      totalNegativeDays += negativeDays
      negativeDetails.push({
        policyName: balance.policy?.name ?? '미지정',
        negativeDays,
        amount: 0, // will be calculated below
      })
    }
  }

  if (totalNegativeDays === 0) return null

  // 3. Get daily wage rate (from latest compensation)
  const compensation = await prisma.compensationHistory.findFirst({
    where: { employeeId },
    orderBy: { effectiveDate: 'desc' },
  })

  // Daily rate = annual salary / 365 (simplified)
  // Korean labor law: 통상임금 / (월 소정근로시간) × 8
  const annualSalary = compensation
    ? Number(compensation.newBaseSalary)
    : 0
  const dailyRate = annualSalary > 0 ? Math.round(annualSalary / 365) : 0

  // 4. Calculate deduction amounts
  for (const detail of negativeDetails) {
    detail.amount = Math.round(detail.negativeDays * dailyRate)
  }

  const totalAmount = negativeDetails.reduce((sum, d) => sum + d.amount, 0)

  return {
    employeeId,
    deductionDays: totalNegativeDays,
    dailyRate,
    deductionAmount: totalAmount,
    details: negativeDetails,
  }
}
