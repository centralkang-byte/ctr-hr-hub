// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Year-End Settlement Submit API
// POST /api/v1/year-end/settlements/[id]/submit
//      — submit settlement (status: in_progress → submitted → hr_review)
//        triggers calculation
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
      })

      if (!settlement) {
        throw new AppError(404, 'NOT_FOUND', '정산 정보를 찾을 수 없습니다.')
      }
      if (settlement.employeeId !== user.employeeId) {
        throw new AppError(403, 'FORBIDDEN', '접근 권한이 없습니다.')
      }
      if (settlement.status === 'submitted' || settlement.status === 'hr_review' || settlement.status === 'confirmed') {
        throw new AppError(400, 'BAD_REQUEST', '이미 제출된 정산입니다.')
      }

      // Run calculation before submitting
      const result = await calculateYearEndSettlement(id, user.employeeId, settlement.year)

      // Update settlement with calculation results and mark as submitted
      const updated = await prisma.yearEndSettlement.update({
        where: { id },
        data: {
          status: 'submitted',
          submittedAt: new Date(),
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
        include: {
          dependents: true,
          deductions: true,
          documents: true,
        },
      })

      return apiSuccess(serializeBigInt(updated))
    } catch (error) {
      return apiError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)
