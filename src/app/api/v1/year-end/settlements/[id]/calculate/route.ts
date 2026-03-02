// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Year-End Calculation API
// POST /api/v1/year-end/settlements/[id]/calculate
//      — run calculateYearEndSettlement() and update settlement record
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { AppError } from '@/lib/errors'
import { calculateYearEndSettlement } from '@/lib/payroll/yearEndCalculation'
import type { SessionUser } from '@/types'

function serializeBigInt(obj: unknown): unknown {
  return JSON.parse(
    JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
  )
}

export const POST = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    try {
      const { id } = await context.params

      const settlement = await prisma.yearEndSettlement.findUnique({
        where: { id },
        select: { id: true, employeeId: true, year: true, status: true },
      })

      if (!settlement) {
        throw new AppError(404, 'NOT_FOUND', '정산 정보를 찾을 수 없습니다.')
      }
      if (settlement.employeeId !== user.employeeId) {
        throw new AppError(403, 'FORBIDDEN', '접근 권한이 없습니다.')
      }

      // Run the 11-step calculation
      const result = await calculateYearEndSettlement(id, user.employeeId, settlement.year)

      // Update settlement with computed values (preview — does NOT change status)
      const updated = await prisma.yearEndSettlement.update({
        where: { id },
        data: {
          totalSalary: result.totalSalary,
          earnedIncomeDeduction: result.earnedIncomeDeduction,
          earnedIncome: result.earnedIncome,
          totalIncomeDeduction: result.totalIncomeDeduction,
          taxableBase: result.taxableBase,
          taxRate: result.taxRate,
          calculatedTax: result.calculatedTax,
          totalTaxCredit: result.totalTaxCredit,
          determinedTax: result.determinedTax,
          prepaidTax: result.prepaidTax,
          finalSettlement: result.finalSettlement,
          localTaxSettlement: result.localTaxSettlement,
        },
      })

      return apiSuccess(serializeBigInt({
        settlement: updated,
        calculation: result,
      }))
    } catch (error) {
      return apiError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)
