// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Withholding Receipt Generation API
// POST /api/v1/year-end/hr/settlements/[id]/receipt
//      — generate withholding receipt PDF (원천징수영수증)
//        creates WithholdingReceipt record and returns HTML/PDF
// ═══════════════════════════════════════════════════════════

import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { badRequest, conflict, forbidden, notFound } from '@/lib/errors'
import { generateWithholdingReceiptPdf } from '@/lib/payroll/yearEndReceiptPdf'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import type { SessionUser } from '@/types'
import { readYearEndOwner } from '@/lib/payroll/year-end-settlement-owner'
import { acquirePrimaryAssignmentEmployeeLocks } from '@/lib/employee/primary-assignment-writer'

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

      const { settlement, ownerCompanyId, pdfBuffer } = await prisma.$transaction(
        async (tx) => {
          await acquirePrimaryAssignmentEmployeeLocks(tx, [candidate.employeeId])
          const locked = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id::text AS "id"
            FROM year_end_settlements
            WHERE id = ${id}
            FOR UPDATE
          `
          if (locked.length !== 1) throw notFound('정산 정보를 찾을 수 없습니다.')

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
            throw forbidden('해당 직원의 영수증을 발행할 권한이 없습니다.')
          }
          if (settlement.status !== 'confirmed') {
            throw badRequest('확정된 정산만 원천징수영수증을 발행할 수 있습니다.')
          }

          const pdfBuffer = await generateWithholdingReceiptPdf(id, {
            expectedOwnerCompanyId: owner.companyId,
            db: tx,
          })
          const issuedAt = new Date()
          await tx.withholdingReceipt.upsert({
            where: { settlementId: id },
            create: {
              settlementId: id,
              employeeId: settlement.employeeId,
              year: settlement.year,
              issuedAt,
            },
            update: { issuedAt },
          })

          return { settlement, ownerCompanyId: owner.companyId, pdfBuffer }
        },
      )

      // Audit log
      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'WITHHOLDING_RECEIPT_ISSUE',
        resourceType: 'WithholdingReceipt',
        resourceId: id,
        companyId: ownerCompanyId,
        changes: {
          employeeId: settlement.employeeId,
          employeeName: settlement.employee.name,
          year: settlement.year,
        },
        ip,
        userAgent,
      })

      // Return HTML content as a downloadable file
      const htmlString = pdfBuffer.toString('utf-8')
      return new NextResponse(htmlString, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="withholding-receipt-${settlement.year}-${settlement.employeeId}.html"`,
        },
      })
    } catch (error) {
      return apiError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.APPROVE),
)
