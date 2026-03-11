// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Balance Renewal (연초 잔액 갱신)
// src/lib/leave/balance-renewal.ts
//
// F-3: Annual balance renewal logic with negative repayment
//   1. Calculate carry-over from previous year
//   2. Deduct negative balance (auto-repayment)
//   3. Grant new year entitlement (via accrualEngine)
//   4. Update EmployeeLeaveBalance
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

export interface RenewalResult {
  employeeId: string
  policyId: string
  year: number
  previousRemaining: number
  carriedOver: number
  negativeRepaid: number
  newEntitlement: number
  totalDays: number
}

/**
 * Renew leave balance for one employee + one policy for the new year.
 * Handles carry-over and negative balance auto-repayment.
 */
export async function renewLeaveBalance(
  employeeId: string,
  policyId: string,
  newYear: number,
): Promise<RenewalResult | null> {
  // 1. Get previous year's balance
  const prevBalance = await prisma.employeeLeaveBalance.findFirst({
    where: { employeeId, policyId, year: newYear - 1 },
  })

  // 2. Get policy info for carry-over rules
  const policy = await prisma.leavePolicy.findFirst({
    where: { id: policyId, deletedAt: null },
  })

  if (!policy) return null

  // 3. Calculate carry-over
  let carriedOver = 0
  let negativeRepaid = 0
  let previousRemaining = 0

  if (prevBalance) {
    previousRemaining =
      Number(prevBalance.grantedDays) +
      Number(prevBalance.carryOverDays) -
      Number(prevBalance.usedDays)

    if (previousRemaining >= 0) {
      // Positive remaining → carry over (up to limit)
      const maxCarryOver = policy.carryOverAllowed
        ? Number(policy.maxCarryOverDays ?? previousRemaining)
        : 0
      carriedOver = Math.min(previousRemaining, maxCarryOver)
    } else {
      // Negative remaining → auto-repayment from new year entitlement
      negativeRepaid = Math.abs(previousRemaining)
      carriedOver = 0
    }
  }

  // 4. New year entitlement (simplified: use policy default_days)
  // Full accrual logic is handled by accrualEngine.processAnnualAccrual
  const newEntitlement = Number(policy.defaultDays)

  // 5. Apply negative repayment to entitlement
  const effectiveEntitlement = Math.max(newEntitlement - negativeRepaid, 0)
  const totalDays = effectiveEntitlement + carriedOver

  // 6. Upsert new year's balance
  const existing = await prisma.employeeLeaveBalance.findFirst({
    where: { employeeId, policyId, year: newYear },
  })

  if (existing) {
    await prisma.employeeLeaveBalance.update({
      where: { id: existing.id },
      data: {
        grantedDays: effectiveEntitlement,
        carryOverDays: carriedOver,
      },
    })
  } else {
    await prisma.employeeLeaveBalance.create({
      data: {
        employeeId,
        policyId,
        year: newYear,
        grantedDays: effectiveEntitlement,
        usedDays: 0,
        pendingDays: 0,
        carryOverDays: carriedOver,
      },
    })
  }

  return {
    employeeId,
    policyId,
    year: newYear,
    previousRemaining,
    carriedOver,
    negativeRepaid,
    newEntitlement,
    totalDays,
  }
}

/**
 * Batch renew all employees for a company.
 * Called by cron or manual HR action at year start.
 */
export async function batchRenewLeaveBalances(
  companyId: string,
  newYear: number,
): Promise<{ processed: number; errors: number; results: RenewalResult[] }> {
  const employees = await prisma.employee.findMany({
    where: {
      deletedAt: null,
      assignments: {
        some: { companyId, isPrimary: true, endDate: null },
      },
    },
    select: { id: true },
  })

  const policies = await prisma.leavePolicy.findMany({
    where: { companyId, isActive: true, deletedAt: null },
    select: { id: true },
  })

  let processed = 0
  let errors = 0
  const results: RenewalResult[] = []

  for (const emp of employees) {
    for (const pol of policies) {
      try {
        const result = await renewLeaveBalance(emp.id, pol.id, newYear)
        if (result) {
          results.push(result)
          processed++
        }
      } catch (err) {
        console.error(`[balance-renewal] Failed: emp=${emp.id}, pol=${pol.id}`, err)
        errors++
      }
    }
  }

  return { processed, errors, results }
}
