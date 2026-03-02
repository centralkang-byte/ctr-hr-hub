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
import { AppError } from '@/lib/errors'
import { generateWithholdingReceiptPdf } from '@/lib/payroll/yearEndReceiptPdf'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import type { SessionUser } from '@/types'

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

      // Company scope check
      const employeeCompanyId = (settlement.employee.assignments?.[0] as { companyId?: string })?.companyId
      if (user.role !== ROLE.SUPER_ADMIN && employeeCompanyId && employeeCompanyId !== user.companyId) {
        throw new AppError(403, 'FORBIDDEN', '해당 직원의 영수증을 발행할 권한이 없습니다.')
      }

      // Only confirmed settlements can have receipts issued
      if (settlement.status !== 'confirmed') {
        throw new AppError(
          400,
          'BAD_REQUEST',
          '확정된 정산만 원천징수영수증을 발행할 수 있습니다.',
        )
      }

      // Generate the PDF (HTML as buffer)
      const pdfBuffer = await generateWithholdingReceiptPdf(id)

      // Upsert the WithholdingReceipt record
      await prisma.withholdingReceipt.upsert({
        where: { settlementId: id },
        create: {
          settlementId: id,
          employeeId: settlement.employeeId,
          year: settlement.year,
          issuedAt: new Date(),
        },
        update: {
          issuedAt: new Date(),
        },
      })

      // Audit log
      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'WITHHOLDING_RECEIPT_ISSUE',
        resourceType: 'WithholdingReceipt',
        resourceId: id,
        companyId: user.companyId,
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
