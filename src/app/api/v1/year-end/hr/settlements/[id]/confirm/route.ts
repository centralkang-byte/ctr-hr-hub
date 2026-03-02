// ═══════════════════════════════════════════════════════════
// CTR HR Hub — HR Year-End Settlement Confirm API
// POST /api/v1/year-end/hr/settlements/[id]/confirm
//      — confirm settlement (status: submitted|hr_review → confirmed)
//        sets confirmedAt and confirmedBy
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { AppError } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
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

      // Fetch the settlement
      const settlement = await prisma.yearEndSettlement.findUnique({
        where: { id },
        include: {
          employee: {
            select: {
              name: true,
              assignments: {
                where: { isPrimary: true, endDate: null },
                take: 1,
                select: { companyId: true },
              },
            },
          },
        },
      })

      if (!settlement) {
        throw new AppError(404, 'NOT_FOUND', '정산 정보를 찾을 수 없습니다.')
      }

      // Company scope check — HR_ADMIN can only confirm their own company's employees
      const employeeCompanyId = (settlement.employee.assignments?.[0] as { companyId?: string })?.companyId
      if (user.role !== ROLE.SUPER_ADMIN && employeeCompanyId && employeeCompanyId !== user.companyId) {
        throw new AppError(403, 'FORBIDDEN', '해당 직원의 정산을 확정할 권한이 없습니다.')
      }

      // Status check — must be submitted or hr_review to confirm
      const allowedStatuses = ['submitted', 'hr_review']
      if (!allowedStatuses.includes(settlement.status)) {
        throw new AppError(
          400,
          'BAD_REQUEST',
          `제출 완료 또는 HR검토 상태의 정산만 확정할 수 있습니다. 현재 상태: ${settlement.status}`,
        )
      }

      // Update to confirmed
      const updated = await prisma.yearEndSettlement.update({
        where: { id },
        data: {
          status: 'confirmed',
          confirmedAt: new Date(),
          confirmedBy: user.employeeId,
        },
        include: {
          dependents: true,
          deductions: true,
          withholdingReceipt: true,
        },
      })

      // Audit log
      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'YEAR_END_SETTLEMENT_CONFIRM',
        resourceType: 'YearEndSettlement',
        resourceId: id,
        companyId: user.companyId,
        changes: {
          employeeId: settlement.employeeId,
          employeeName: settlement.employee.name,
          year: settlement.year,
          previousStatus: settlement.status,
          newStatus: 'confirmed',
        },
        ip,
        userAgent,
      })

      return apiSuccess(serializeBigInt(updated))
    } catch (error) {
      return apiError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.APPROVE),
)
