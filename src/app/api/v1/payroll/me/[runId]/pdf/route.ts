// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/me/[runId]/pdf — 급여명세서 PDF 다운로드
// ═══════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/permissions'
import { AppError, notFound } from '@/lib/errors'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import { generatePayStubPdf, type PayrollItemWithRelations } from '@/lib/payroll/pdf'
import { normaliseDetail } from '@/lib/payroll/normalise-detail'
import { getRequestLocale } from '@/lib/server-i18n'

// Self-service: query is hard-scoped to user.employeeId/companyId below, so
// withAuth is correct — withPermission(payroll_read) wrongly blocked MANAGER.
export const GET = withAuth(
  async (_req, context, user) => {
    await getRequestLocale()
    // DD-3: Korean legal payslip must be in Korean
    const pdfLocale = 'ko' as const
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
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              select: {
                department: { select: { name: true } },
                jobGrade: { select: { name: true } },
                company: { select: { name: true } },
              },
            },
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

    // Adapt the Prisma result to generatePayStubPdf's contract:
    //  - department/jobGrade/company live under the primary assignment (Track B
    //    convention), but the generator reads them flat off `employee`.
    //  - detail is stored raw (engine {earnings,insurance,tax} or legacy
    //    {components,deductions}); the generator expects the normalised shape.
    // Skipping either adaptation is what made this endpoint 500 for every role.
    const primary = extractPrimaryAssignment(item.employee.assignments ?? [])
    const pdfInput: PayrollItemWithRelations = {
      ...item,
      detail: normaliseDetail(item.detail, Number(item.grossPay), Number(item.netPay)),
      employee: {
        name: item.employee.name,
        employeeNo: item.employee.employeeNo,
        department: { name: primary?.department?.name ?? '-' },
        jobGrade: { name: primary?.jobGrade?.name ?? '-' },
        company: { name: primary?.company?.name ?? '-' },
      },
    }

    try {
      const pdfBuffer = await generatePayStubPdf(pdfLocale, pdfInput)
      const uint8 = new Uint8Array(pdfBuffer)

      return new NextResponse(uint8, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="payslip_${item.run.yearMonth}_${item.employee.employeeNo}.html"`,
        },
      })
    } catch (error) {
      // Don't swallow: log the real cause server-side, then surface a meaningful
      // AppError. The underlying message is NOT placed in AppError.details —
      // apiError serialises details into the client response, which would leak
      // internals. withAuth converts the throw via apiError (Sentry-captures 5xx).
      console.error('[payroll/me/pdf] payslip generation failed', {
        runId,
        employeeId: user.employeeId,
        error,
      })
      throw new AppError(500, 'PAYSLIP_GENERATION_FAILED', '급여명세서 생성에 실패했습니다.')
    }
  },
)
