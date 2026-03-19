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
import type { SessionUser } from '@/types'

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

      // Determine which companyId(s) to scope to
      let companyIdFilter: string | undefined
      if (user.role === ROLE.SUPER_ADMIN) {
        // SUPER_ADMIN can filter by any companyId or see all
        companyIdFilter = searchParams.get('companyId') ?? undefined
      } else {
        // HR_ADMIN can only see their own company
        companyIdFilter = user.companyId
      }

      // Build employee filter based on assignments
      const assignmentWhere = companyIdFilter
        ? { assignments: { some: { companyId: companyIdFilter, isPrimary: true, endDate: null } } }
        : {}

      // Build settlement where clause
      const settlementWhere: Record<string, unknown> = {
        year,
        employee: assignmentWhere,
      }
      if (status) {
        settlementWhere.status = status
      }

      const [total, settlements] = await Promise.all([
        prisma.yearEndSettlement.count({ where: settlementWhere }),
        prisma.yearEndSettlement.findMany({
          where: settlementWhere,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                employeeNo: true,
                assignments: {
                  where: { isPrimary: true, endDate: null },
                  take: 1,
                  include: {
                    department: { select: { id: true, name: true } },
                    company: { select: { id: true, name: true } },
                  },
                },
              },
            },
            withholdingReceipt: {
              select: { id: true, issuedAt: true, pdfPath: true },
            },
          },
        }),
      ])

      const data = settlements.map((s) => {
        const assignment = s.employee.assignments?.[0]
        return {
          id: s.id,
          employeeId: s.employeeId,
          employeeName: s.employee.name,
          employeeNo: s.employee.employeeNo,
          department: assignment?.department?.name ?? '-',
          company: assignment?.company?.name ?? '-',
          companyId: (assignment as { companyId?: string })?.companyId ?? user.companyId,
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
        }
      })

      // Also return summary counts grouped by status
      const summaryRaw = await prisma.yearEndSettlement.groupBy({
        by: ['status'],
        where: {
          year,
          employee: assignmentWhere,
        },
        _count: { id: true },
      })

      const summary: Record<string, number> = {
        not_started: 0,
        in_progress: 0,
        submitted: 0,
        hr_review: 0,
        confirmed: 0,
      }
      for (const row of summaryRaw) {
        if (row.status in summary) {
          summary[row.status] = row._count.id
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
