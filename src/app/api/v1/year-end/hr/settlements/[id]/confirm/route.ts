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
import { badRequest, conflict, forbidden, notFound } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import type { SessionUser } from '@/types'
import { readYearEndOwner } from '@/lib/payroll/year-end-settlement-owner'
import { acquirePrimaryAssignmentEmployeeLocks } from '@/lib/employee/primary-assignment-writer'

function serializeBigInt(obj: unknown): unknown {
  return JSON.parse(
    JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
  )
}

export const POST = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    try {
      const { id } = await context.params

      const candidate = await prisma.yearEndSettlement.findUnique({
        where: { id },
        select: { employeeId: true, year: true },
      })
      if (!candidate) {
        throw notFound('정산 정보를 찾을 수 없습니다.')
      }

      const { settlement, ownerCompanyId, updated } = await prisma.$transaction(
        async (tx) => {
          await acquirePrimaryAssignmentEmployeeLocks(tx, [candidate.employeeId])
          const settlement = await tx.yearEndSettlement.findUnique({
            where: { id },
            select: {
              id: true,
              employeeId: true,
              year: true,
              status: true,
              employee: { select: { name: true } },
            },
          })
          if (!settlement) throw notFound('정산 정보를 찾을 수 없습니다.')
          if (
            settlement.employeeId !== candidate.employeeId ||
            settlement.year !== candidate.year
          ) {
            throw conflict('정산 대상 정보가 변경되었습니다. 다시 시도해 주세요.')
          }

          const owner = await readYearEndOwner(
            settlement.employeeId,
            settlement.year,
            tx,
          )
          if (!owner.resolved) {
            throw conflict('정산 귀속 법인을 하나로 확정할 수 없습니다.')
          }
          if (
            user.role !== ROLE.SUPER_ADMIN &&
            owner.companyId !== user.companyId
          ) {
            throw forbidden('해당 직원의 정산을 확정할 권한이 없습니다.')
          }

          const allowedStatuses = ['submitted', 'hr_review']
          if (!allowedStatuses.includes(settlement.status)) {
            throw badRequest(
              `제출 완료 또는 HR검토 상태의 정산만 확정할 수 있습니다. 현재 상태: ${settlement.status}`,
            )
          }

          const transition = await tx.yearEndSettlement.updateMany({
            where: { id, status: { in: allowedStatuses } },
            data: {
              status: 'confirmed',
              confirmedAt: new Date(),
              confirmedBy: user.employeeId,
            },
          })
          if (transition.count !== 1) {
            throw conflict('정산 상태가 변경되었습니다. 다시 시도해 주세요.')
          }
          const updated = await tx.yearEndSettlement.findUniqueOrThrow({
            where: { id },
            include: {
              dependents: true,
              deductions: true,
              withholdingReceipt: true,
            },
          })

          return { settlement, ownerCompanyId: owner.companyId, updated }
        },
      )

      // Audit log
      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'YEAR_END_SETTLEMENT_CONFIRM',
        resourceType: 'YearEndSettlement',
        resourceId: id,
        companyId: ownerCompanyId,
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
