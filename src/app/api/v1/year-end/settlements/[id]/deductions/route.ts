// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Year-End Deductions API
// GET /api/v1/year-end/settlements/[id]/deductions
//     — list deductions
// PUT /api/v1/year-end/settlements/[id]/deductions
//     — bulk replace deductions with deductible amount calculation
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { AppError } from '@/lib/errors'
import { calculateDeductibleAmount } from '@/lib/payroll/deductionCalculator'
import { sumAnnualGross } from '@/lib/payroll/yearEndCalculation'
import type { SessionUser } from '@/types'

interface DeductionInput {
  configCode: string
  category: string
  name: string
  inputAmount: number
  details?: Record<string, number>
}

function serializeBigInt(obj: unknown): unknown {
  return JSON.parse(
    JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
  )
}

async function verifyOwnership(id: string, employeeId: string) {
  const settlement = await prisma.yearEndSettlement.findUnique({
    where: { id },
    select: { id: true, employeeId: true, status: true, year: true },
  })
  if (!settlement) throw new AppError(404, 'NOT_FOUND', '정산 정보를 찾을 수 없습니다.')
  if (settlement.employeeId !== employeeId) throw new AppError(403, 'FORBIDDEN', '접근 권한이 없습니다.')
  return settlement
}

// GET — list deductions
export const GET = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    try {
      const { id } = await context.params
      await verifyOwnership(id, user.employeeId)

      const deductions = await prisma.yearEndDeduction.findMany({
        where: { settlementId: id },
        orderBy: { createdAt: 'asc' },
      })

      return apiSuccess(serializeBigInt(deductions))
    } catch (error) {
      return apiError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)

// PUT — bulk replace deductions with calculated deductible amounts
export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    try {
      const { id } = await context.params
      const settlement = await verifyOwnership(id, user.employeeId)

      if (settlement.status === 'submitted' || settlement.status === 'confirmed') {
        throw new AppError(400, 'BAD_REQUEST', '제출 완료된 정산은 수정할 수 없습니다.')
      }

      const body = await req.json() as { deductions: DeductionInput[] }
      const { deductions } = body

      if (!Array.isArray(deductions)) {
        throw new AppError(400, 'BAD_REQUEST', '공제 항목 목록이 필요합니다.')
      }

      // Get total salary for deduction calculation
      const totalSalary = Number(await sumAnnualGross(user.employeeId, settlement.year))

      // Calculate deductible amounts for each deduction
      const deductionData = await Promise.all(
        deductions.map(async (d) => {
          const deductibleAmount = await calculateDeductibleAmount(
            d.configCode,
            d.inputAmount,
            totalSalary,
            settlement.year,
            d.details,
          )

          return {
            settlementId: id,
            configCode: d.configCode,
            category: d.category,
            name: d.name,
            inputAmount: BigInt(Math.round(d.inputAmount)),
            deductibleAmount: BigInt(Math.round(deductibleAmount)),
            details: d.details ? JSON.parse(JSON.stringify(d.details)) : undefined,
            source: 'manual',
          }
        }),
      )

      const result = await prisma.$transaction(async (tx) => {
        await tx.yearEndDeduction.deleteMany({ where: { settlementId: id } })
        await tx.yearEndDeduction.createMany({ data: deductionData })

        // Update settlement status to in_progress if not_started
        if (settlement.status === 'not_started') {
          await tx.yearEndSettlement.update({
            where: { id },
            data: { status: 'in_progress' },
          })
        }

        return tx.yearEndDeduction.findMany({
          where: { settlementId: id },
          orderBy: { createdAt: 'asc' },
        })
      })

      return apiSuccess(serializeBigInt(result))
    } catch (error) {
      return apiError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)
