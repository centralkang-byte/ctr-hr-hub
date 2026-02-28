// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/me/[runId]/pdf — 급여명세서 PDF 다운로드
// ═══════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { notFound } from '@/lib/errors'
import { apiError } from '@/lib/api'
import { generatePayStubPdf } from '@/lib/payroll/pdf'

export const GET = withPermission(
  async (_req, context, user) => {
    const { runId } = await context.params

    const item = await prisma.payrollItem.findFirst({
      where: {
        employeeId: user.employeeId,
        run: {
          id: runId,
          companyId: user.companyId,
          status: 'PAID',
        },
      },
      include: {
        employee: {
          select: {
            name: true,
            employeeNo: true,
            department: { select: { name: true } },
            jobGrade: { select: { name: true } },
            company: { select: { name: true } },
          },
        },
        run: {
          select: {
            name: true,
            yearMonth: true,
            periodStart: true,
            periodEnd: true,
            payDate: true,
          },
        },
      },
    })

    if (!item) throw notFound('급여명세서를 찾을 수 없습니다.')

    try {
      const pdfBuffer = await generatePayStubPdf(item)
      const uint8 = new Uint8Array(pdfBuffer)

      return new NextResponse(uint8, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="payslip_${item.run.yearMonth}_${item.employee.employeeNo}.html"`,
        },
      })
    } catch {
      return apiError(new Error('PDF 생성에 실패했습니다.'))
    }
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)
