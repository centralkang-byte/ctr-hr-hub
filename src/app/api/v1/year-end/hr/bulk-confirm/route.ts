// ═══════════════════════════════════════════════════════════
// CTR HR Hub — HR Year-End Bulk Confirm API
// POST /api/v1/year-end/hr/bulk-confirm
//      — bulk confirm settlements
//        { year, companyId, settlementIds[] }
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { AppError } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import type { SessionUser } from '@/types'

interface BulkConfirmBody {
  year?: number
  companyId?: string
  settlementIds?: string[]
}

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    try {
      const body = (await req.json()) as BulkConfirmBody
      const { settlementIds, year, companyId } = body

      if (!settlementIds || !Array.isArray(settlementIds) || settlementIds.length === 0) {
        throw new AppError(400, 'BAD_REQUEST', '확정할 정산 ID 목록이 필요합니다.')
      }

      if (settlementIds.length > 200) {
        throw new AppError(400, 'BAD_REQUEST', '한 번에 최대 200건까지 일괄 확정할 수 있습니다.')
      }

      // Determine scope
      const scopeCompanyId = user.role === ROLE.SUPER_ADMIN ? (companyId ?? undefined) : user.companyId

      // Fetch settlements to validate them
      const settlements = await prisma.yearEndSettlement.findMany({
        where: {
          id: { in: settlementIds },
          ...(year ? { year } : {}),
          status: { in: ['submitted', 'hr_review'] },
          employee: scopeCompanyId
            ? {
                assignments: {
                  some: { companyId: scopeCompanyId, isPrimary: true, endDate: null },
                },
              }
            : undefined,
        },
        select: { id: true, status: true, employeeId: true, year: true },
      })

      if (settlements.length === 0) {
        throw new AppError(
          400,
          'BAD_REQUEST',
          '확정 가능한 정산이 없습니다. 제출완료(submitted) 또는 HR검토(hr_review) 상태인 정산만 확정할 수 있습니다.',
        )
      }

      const validIds = settlements.map((s) => s.id)
      const skippedCount = settlementIds.length - validIds.length

      // Bulk update in a transaction
      const now = new Date()
      const confirmedBy = user.employeeId

      await prisma.$transaction(async (tx) => {
        await tx.yearEndSettlement.updateMany({
          where: { id: { in: validIds } },
          data: {
            status: 'confirmed',
            confirmedAt: now,
            confirmedBy,
          },
        })
      })

      // Audit log
      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'YEAR_END_SETTLEMENT_BULK_CONFIRM',
        resourceType: 'YearEndSettlement',
        resourceId: 'bulk',
        companyId: user.companyId,
        changes: {
          year: year ?? 'all',
          confirmedCount: validIds.length,
          skippedCount,
          settlementIds: validIds,
        },
        ip,
        userAgent,
      })

      return apiSuccess({
        confirmedCount: validIds.length,
        skippedCount,
        confirmedIds: validIds,
        message: `${validIds.length}건의 정산이 확정되었습니다.${skippedCount > 0 ? ` (${skippedCount}건 건너뜀)` : ''}`,
      })
    } catch (error) {
      return apiError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.APPROVE),
)
