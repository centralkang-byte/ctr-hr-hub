// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Year-End Settlement Detail API
// GET  /api/v1/year-end/settlements/[id]
//      — get settlement detail with dependents, deductions, documents
// PUT  /api/v1/year-end/settlements/[id]
//      — update settlement fields
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { AppError } from '@/lib/errors'
import type { SessionUser } from '@/types'

function serializeBigInt(obj: unknown): unknown {
  return JSON.parse(
    JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
  )
}

async function getSettlementForUser(id: string, employeeId: string) {
  const settlement = await prisma.yearEndSettlement.findUnique({
    where: { id },
    include: {
      dependents: { orderBy: { createdAt: 'asc' } },
      deductions: { orderBy: { createdAt: 'asc' } },
      documents: { orderBy: { uploadedAt: 'desc' } },
    },
  })
  if (!settlement) throw new AppError(404, 'NOT_FOUND', '정산 정보를 찾을 수 없습니다.')
  if (settlement.employeeId !== employeeId) {
    throw new AppError(403, 'FORBIDDEN', '접근 권한이 없습니다.')
  }
  return settlement
}

// GET — get settlement detail
export const GET = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    try {
      const { id } = await context.params
      const settlement = await getSettlementForUser(id, user.employeeId)
      return apiSuccess(serializeBigInt(settlement))
    } catch (error) {
      return apiError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)

// PUT — update settlement fields (status changes to in_progress if was not_started)
export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    try {
      const { id } = await context.params
      const settlement = await getSettlementForUser(id, user.employeeId)

      if (settlement.status === 'submitted' || settlement.status === 'confirmed') {
        throw new AppError(400, 'BAD_REQUEST', '제출 완료된 정산은 수정할 수 없습니다.')
      }

      const body = await req.json() as Record<string, unknown>

      // Only allow certain fields to be updated
      const allowedFields = ['status']
      const updateData: Record<string, unknown> = {}

      for (const key of allowedFields) {
        if (key in body) updateData[key] = body[key]
      }

      // Move status to in_progress when user starts editing
      if (settlement.status === 'not_started' && Object.keys(updateData).length > 0) {
        if (updateData.status === undefined) {
          updateData.status = 'in_progress'
        }
      }

      const updated = await prisma.yearEndSettlement.update({
        where: { id },
        data: updateData,
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
