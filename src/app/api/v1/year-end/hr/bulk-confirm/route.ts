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
import { badRequest, conflict } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import type { SessionUser } from '@/types'
import { readYearEndOwners } from '@/lib/payroll/year-end-settlement-owner'
import { acquirePrimaryAssignmentEmployeeLocks } from '@/lib/employee/primary-assignment-writer'

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
        throw badRequest('확정할 정산 ID 목록이 필요합니다.')
      }

      if (settlementIds.length > 200) {
        throw badRequest('한 번에 최대 200건까지 일괄 확정할 수 있습니다.')
      }

      // Determine scope
      const scopeCompanyId = user.role === ROLE.SUPER_ADMIN ? (companyId ?? undefined) : user.companyId

      const candidates = await prisma.yearEndSettlement.findMany({
        where: {
          id: { in: settlementIds },
          ...(year ? { year } : {}),
          status: { in: ['submitted', 'hr_review'] },
        },
        select: { id: true, status: true, employeeId: true, year: true },
      })
      const candidateById = new Map(
        candidates.map((candidate) => [candidate.id, candidate]),
      )
      const now = new Date()
      const confirmedBy = user.employeeId

      const validSettlements = await prisma.$transaction(async (tx) => {
        await acquirePrimaryAssignmentEmployeeLocks(
          tx,
          candidates.map((candidate) => candidate.employeeId),
        )
        const settlements = await tx.yearEndSettlement.findMany({
          where: {
            id: { in: candidates.map((candidate) => candidate.id) },
            ...(year ? { year } : {}),
            status: { in: ['submitted', 'hr_review'] },
          },
          select: { id: true, status: true, employeeId: true, year: true },
        })
        const stableSettlements = settlements.filter((settlement) => {
          const candidate = candidateById.get(settlement.id)
          return (
            candidate?.employeeId === settlement.employeeId &&
            candidate.year === settlement.year
          )
        })
        const settlementsByYear = new Map<number, typeof stableSettlements>()
        for (const settlement of stableSettlements) {
          const rows = settlementsByYear.get(settlement.year) ?? []
          rows.push(settlement)
          settlementsByYear.set(settlement.year, rows)
        }

        const validSettlements: Array<
          (typeof stableSettlements)[number] & { ownerCompanyId: string }
        > = []
        for (const [settlementYear, rows] of settlementsByYear) {
          const owners = await readYearEndOwners(
            rows.map((settlement) => settlement.employeeId),
            settlementYear,
            tx,
          )
          for (const settlement of rows) {
            const owner = owners.get(settlement.employeeId)
            if (
              owner?.resolved &&
              (scopeCompanyId === undefined ||
                owner.companyId === scopeCompanyId)
            ) {
              validSettlements.push({
                ...settlement,
                ownerCompanyId: owner.companyId,
              })
            }
          }
        }

        if (validSettlements.length === 0) {
          throw badRequest(
            '확정 가능한 정산이 없습니다. 제출완료(submitted) 또는 HR검토(hr_review) 상태이며 귀속 법인이 확인되는 정산만 확정할 수 있습니다.',
          )
        }

        const confirmed = await tx.yearEndSettlement.updateManyAndReturn({
          where: {
            id: { in: validSettlements.map((settlement) => settlement.id) },
            status: { in: ['submitted', 'hr_review'] },
          },
          data: {
            status: 'confirmed',
            confirmedAt: now,
            confirmedBy,
          },
          select: { id: true },
        })
        if (confirmed.length === 0) {
          throw conflict('정산 상태가 변경되었습니다. 다시 시도해 주세요.')
        }
        const confirmedIds = new Set(confirmed.map((settlement) => settlement.id))
        return validSettlements.filter((settlement) =>
          confirmedIds.has(settlement.id),
        )
      })

      const validIds = validSettlements.map((settlement) => settlement.id)
      const skippedCount = settlementIds.length - validIds.length

      // Audit log
      const { ip, userAgent } = extractRequestMeta(req.headers)
      const idsByOwner = new Map<string, string[]>()
      for (const settlement of validSettlements) {
        const ids = idsByOwner.get(settlement.ownerCompanyId) ?? []
        ids.push(settlement.id)
        idsByOwner.set(settlement.ownerCompanyId, ids)
      }
      for (const [ownerCompanyId, ownerSettlementIds] of idsByOwner) {
        logAudit({
          actorId: user.employeeId,
          action: 'YEAR_END_SETTLEMENT_BULK_CONFIRM',
          resourceType: 'YearEndSettlement',
          resourceId: 'bulk',
          companyId: ownerCompanyId,
          changes: {
            year: year ?? 'all',
            confirmedCount: ownerSettlementIds.length,
            skippedCount,
            settlementIds: ownerSettlementIds,
          },
          ip,
          userAgent,
        })
      }

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
