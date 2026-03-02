// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Year-End Dependents API
// GET /api/v1/year-end/settlements/[id]/dependents
//     — list dependents
// PUT /api/v1/year-end/settlements/[id]/dependents
//     — bulk replace dependents (deleteMany + createMany in transaction)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { AppError } from '@/lib/errors'
import type { SessionUser } from '@/types'

interface DependentInput {
  relationship: string
  name: string
  birthDate?: string | null
  isDisabled?: boolean
  isSenior?: boolean
  isSingleParent?: boolean
  deductionAmount?: number
  additionalDeduction?: number
}

async function verifyOwnership(id: string, employeeId: string) {
  const settlement = await prisma.yearEndSettlement.findUnique({
    where: { id },
    select: { id: true, employeeId: true, status: true },
  })
  if (!settlement) throw new AppError(404, 'NOT_FOUND', '정산 정보를 찾을 수 없습니다.')
  if (settlement.employeeId !== employeeId) throw new AppError(403, 'FORBIDDEN', '접근 권한이 없습니다.')
  return settlement
}

// GET — list dependents
export const GET = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    try {
      const { id } = await context.params
      await verifyOwnership(id, user.employeeId)

      const dependents = await prisma.yearEndDependent.findMany({
        where: { settlementId: id },
        orderBy: { createdAt: 'asc' },
      })

      return apiSuccess(dependents)
    } catch (error) {
      return apiError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)

// PUT — bulk replace dependents
export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    try {
      const { id } = await context.params
      const settlement = await verifyOwnership(id, user.employeeId)

      if (settlement.status === 'submitted' || settlement.status === 'confirmed') {
        throw new AppError(400, 'BAD_REQUEST', '제출 완료된 정산은 수정할 수 없습니다.')
      }

      const body = await req.json() as { dependents: DependentInput[] }
      const { dependents } = body

      if (!Array.isArray(dependents)) {
        throw new AppError(400, 'BAD_REQUEST', '부양가족 목록이 필요합니다.')
      }

      // Calculate deduction amounts per dependent
      const deductionData = dependents.map((d) => {
        const base = 1_500_000
        let additional = 0
        if (d.isDisabled) additional += 2_000_000
        if (d.isSenior) additional += 1_000_000
        if (d.isSingleParent) additional += 1_000_000

        return {
          settlementId: id,
          relationship: d.relationship,
          name: d.name,
          birthDate: d.birthDate ? new Date(d.birthDate) : null,
          isDisabled: d.isDisabled ?? false,
          isSenior: d.isSenior ?? false,
          isSingleParent: d.isSingleParent ?? false,
          deductionAmount: d.deductionAmount ?? base,
          additionalDeduction: d.additionalDeduction ?? additional,
        }
      })

      const result = await prisma.$transaction(async (tx) => {
        await tx.yearEndDependent.deleteMany({ where: { settlementId: id } })
        await tx.yearEndDependent.createMany({ data: deductionData })

        // Update settlement status to in_progress if not_started
        if (settlement.status === 'not_started') {
          await tx.yearEndSettlement.update({
            where: { id },
            data: { status: 'in_progress' },
          })
        }

        return tx.yearEndDependent.findMany({
          where: { settlementId: id },
          orderBy: { createdAt: 'asc' },
        })
      })

      return apiSuccess(result)
    } catch (error) {
      return apiError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)
