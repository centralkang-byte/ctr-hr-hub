// ═══════════════════════════════════════════════════════════
// CTR HR Hub — HR Year-End Settlements List API
// GET /api/v1/year-end/hr/settlements
//     ?year=2025&companyId=xxx&status=submitted
//     — HR can view all employees' settlements in their company
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, buildPagination } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { badRequest } from '@/lib/errors'
import type { SessionUser } from '@/types'
import {
  getYearEndOwnershipWindow,
  readYearEndOwners,
} from '@/lib/payroll/year-end-settlement-owner'

interface OwnerPageRow {
  id: string
  employeeId: string
  ownerCompanyId: string
}

interface OwnerSummaryRow {
  status: string
  count: bigint
}

function serializeBigInt(obj: unknown): unknown {
  return JSON.parse(
    JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
  )
}

// GET — list all settlements for HR review
export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    try {
      const { searchParams } = new URL(req.url)
      const year = parseInt(searchParams.get('year') ?? '2025', 10)
      const status = searchParams.get('status') ?? undefined
      const page = parseInt(searchParams.get('page') ?? '1', 10)
      const limit = parseInt(searchParams.get('limit') ?? '50', 10)
      if (
        !Number.isInteger(year) ||
        year < 1900 ||
        year > 2100 ||
        !Number.isInteger(page) ||
        page < 1 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 200
      ) {
        throw badRequest('연도 또는 페이지네이션 파라미터가 올바르지 않습니다.')
      }

      // Determine which companyId(s) to scope to
      let companyIdFilter: string | undefined
      if (user.role === ROLE.SUPER_ADMIN) {
        // SUPER_ADMIN can filter by any companyId or see all
        companyIdFilter = searchParams.get('companyId') ?? undefined
      } else {
        // HR_ADMIN can only see their own company
        companyIdFilter = user.companyId
      }
      const { start, endExclusive } = getYearEndOwnershipWindow(year)
      const companyScope = companyIdFilter ?? null
      const statusScope = status ?? null
      const offset = (page - 1) * limit

      const { scopedOwners, total, settlements, summaryRaw } =
        await prisma.$transaction(
          async (tx) => {
            const ownerPage = await tx.$queryRaw<OwnerPageRow[]>`
              WITH resolved_owners AS (
                SELECT
                  settlement.id,
                  settlement.employee_id,
                  settlement.status,
                  settlement.updated_at,
                  MIN(assignment.company_id::text) AS owner_company_id
                FROM year_end_settlements AS settlement
                INNER JOIN employee_assignments AS assignment
                  ON assignment.employee_id = settlement.employee_id
                WHERE settlement.year = ${year}
                  AND assignment.is_primary = true
                  AND assignment.effective_date < ${endExclusive}
                  AND (assignment.end_date IS NULL OR assignment.end_date > ${start})
                  AND (
                    assignment.end_date IS NULL
                    OR assignment.end_date > assignment.effective_date
                  )
                GROUP BY
                  settlement.id,
                  settlement.employee_id,
                  settlement.status,
                  settlement.updated_at
                HAVING COUNT(DISTINCT assignment.company_id) = 1
              )
              SELECT
                id::text AS "id",
                employee_id::text AS "employeeId",
                owner_company_id AS "ownerCompanyId"
              FROM resolved_owners
              WHERE (${companyScope}::text IS NULL OR owner_company_id = ${companyScope})
                AND (${statusScope}::text IS NULL OR status = ${statusScope})
              ORDER BY status ASC, updated_at DESC, id ASC
              OFFSET ${offset}
              LIMIT ${limit}
            `
            const summaryRaw = await tx.$queryRaw<OwnerSummaryRow[]>`
              WITH resolved_owners AS (
                SELECT
                  settlement.id,
                  settlement.status,
                  MIN(assignment.company_id::text) AS owner_company_id
                FROM year_end_settlements AS settlement
                INNER JOIN employee_assignments AS assignment
                  ON assignment.employee_id = settlement.employee_id
                WHERE settlement.year = ${year}
                  AND assignment.is_primary = true
                  AND assignment.effective_date < ${endExclusive}
                  AND (assignment.end_date IS NULL OR assignment.end_date > ${start})
                  AND (
                    assignment.end_date IS NULL
                    OR assignment.end_date > assignment.effective_date
                  )
                GROUP BY settlement.id, settlement.status
                HAVING COUNT(DISTINCT assignment.company_id) = 1
              )
              SELECT status, COUNT(*)::bigint AS "count"
              FROM resolved_owners
              WHERE (${companyScope}::text IS NULL OR owner_company_id = ${companyScope})
              GROUP BY status
            `
            const settlementById = new Map(
              (
                await tx.yearEndSettlement.findMany({
                  where: { id: { in: ownerPage.map((row) => row.id) } },
                  include: {
                    employee: {
                      select: {
                        id: true,
                        name: true,
                        employeeNo: true,
                      },
                    },
                    withholdingReceipt: {
                      select: { id: true, issuedAt: true, pdfPath: true },
                    },
                  },
                })
              ).map((settlement) => [settlement.id, settlement]),
            )
            const settlements = ownerPage.flatMap((row) => {
              const settlement = settlementById.get(row.id)
              return settlement ? [settlement] : []
            })
            const owners = await readYearEndOwners(
              ownerPage.map((row) => row.employeeId),
              year,
              tx,
            )
            const scopedOwners = new Map(
              ownerPage.flatMap((row) => {
                const owner = owners.get(row.employeeId)
                return owner?.resolved && owner.companyId === row.ownerCompanyId
                  ? ([[row.employeeId, owner]] as const)
                  : []
              }),
            )
            const total = summaryRaw.reduce(
              (sum, row) =>
                status === undefined || row.status === status
                  ? sum + Number(row.count)
                  : sum,
              0,
            )

            return { scopedOwners, total, settlements, summaryRaw }
          },
          { isolationLevel: 'RepeatableRead' },
        )

      const data = settlements.flatMap((s) => {
        const owner = scopedOwners.get(s.employeeId)
        if (!owner) return []

        return [{
          id: s.id,
          employeeId: s.employeeId,
          employeeName: s.employee.name,
          employeeNo: s.employee.employeeNo,
          department: owner.assignment.department?.name ?? '-',
          company: owner.assignment.company.name,
          companyId: owner.companyId,
          year: s.year,
          status: s.status,
          totalSalary: s.totalSalary.toString(),
          finalSettlement: s.finalSettlement.toString(),
          localTaxSettlement: s.localTaxSettlement.toString(),
          determinedTax: s.determinedTax.toString(),
          prepaidTax: s.prepaidTax.toString(),
          submittedAt: s.submittedAt,
          confirmedAt: s.confirmedAt,
          confirmedBy: s.confirmedBy,
          withholdingReceipt: s.withholdingReceipt
            ? {
                id: s.withholdingReceipt.id,
                issuedAt: s.withholdingReceipt.issuedAt,
                pdfPath: s.withholdingReceipt.pdfPath,
              }
            : null,
          updatedAt: s.updatedAt,
        }]
      })

      // Also return summary counts grouped by status
      const summary: Record<string, number> = {
        not_started: 0,
        in_progress: 0,
        submitted: 0,
        hr_review: 0,
        confirmed: 0,
      }
      for (const row of summaryRaw) {
        if (row.status in summary) {
          summary[row.status] = Number(row.count)
        }
      }

      const pagination = buildPagination(page, limit, total)

      return apiSuccess(serializeBigInt({ settlements: data, summary, pagination }))
    } catch (error) {
      return apiError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.APPROVE),
)
