// ═══════════════════════════════════════════════════════════
// GET /api/v1/employees/me/total-rewards — 내 연간 총 보상 집계
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
// fetchPrimaryAssignment unused — baseSalary from CompensationHistory

export const GET = withPermission(
  async (_req, _context, user) => {
    const employeeId = user.employeeId
    if (!employeeId) {
      return apiSuccess({
        baseSalary: 0,
        bonuses: 0,
        allowances: 0,
        benefits: 0,
        rewards: 0,
        total: 0,
        currency: 'KRW',
        yearlyBreakdown: [],
      })
    }

    const now = new Date()
    const currentYear = now.getFullYear()

    // 1. Base salary from latest CompensationHistory
    const latestComp = await prisma.compensationHistory.findFirst({
      where: { employeeId },
      orderBy: { effectiveDate: 'desc' },
      select: { newBaseSalary: true, currency: true },
    })
    const baseSalary = latestComp ? Number(latestComp.newBaseSalary) : 0
    const currency = latestComp?.currency ?? 'KRW'

    // 2. Bonuses — BONUS type PayrollItems from PAID runs this year
    const bonusResult = await prisma.payrollItem.aggregate({
      _sum: { grossPay: true },
      where: {
        employeeId,
        run: {
          status: 'PAID',
          yearMonth: { startsWith: String(currentYear) },
          runType: 'BONUS',
        },
      },
    })
    const bonuses = Number(bonusResult._sum?.grossPay ?? 0)

    // 3. Allowances — active EmployeePayItems of type ALLOWANCE
    const allowanceItems = await prisma.employeePayItem.findMany({
      where: {
        employeeId,
        itemType: 'ALLOWANCE',
        effectiveTo: null, // currently active
      },
      select: { amount: true },
    })
    // Assume monthly frequency, annualize
    const allowances = allowanceItems.reduce((sum, item) => {
      return sum + Number(item.amount ?? 0) * 12
    }, 0)

    // 4. Benefits — approved claims this year
    const benefitResult = await prisma.benefitClaim.aggregate({
      _sum: { claimAmount: true },
      where: {
        employeeId,
        status: 'APPROVED',
        createdAt: {
          gte: new Date(`${currentYear}-01-01`),
          lt: new Date(`${currentYear + 1}-01-01`),
        },
      },
    })
    const benefits = Number(benefitResult._sum?.claimAmount ?? 0)

    // 5. Rewards — BONUS_AWARD type this year
    const rewardResult = await prisma.rewardRecord.aggregate({
      _sum: { amount: true },
      where: {
        employeeId,
        rewardType: 'BONUS_AWARD',
        awardedDate: {
          gte: new Date(`${currentYear}-01-01`),
          lt: new Date(`${currentYear + 1}-01-01`),
        },
      },
    })
    const rewards = Number(rewardResult._sum?.amount ?? 0)

    // 6. Yearly breakdown (last 3 years) for trend
    const yearlyBreakdown = []
    for (let yr = currentYear - 2; yr <= currentYear; yr++) {
      const yrPayroll = await prisma.payrollItem.aggregate({
        _sum: { grossPay: true },
        where: {
          employeeId,
          run: {
            status: 'PAID',
            yearMonth: { startsWith: String(yr) },
          },
        },
      })
      yearlyBreakdown.push({
        year: yr,
        totalPaid: Number(yrPayroll._sum?.grossPay ?? 0),
      })
    }

    const total = baseSalary + bonuses + allowances + benefits + rewards

    return apiSuccess({
      baseSalary,
      bonuses,
      allowances,
      benefits,
      rewards,
      total,
      currency,
      yearlyBreakdown,
    })
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)
