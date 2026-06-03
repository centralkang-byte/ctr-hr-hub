// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/me/[runId]/pdf — 급여명세서 PDF 다운로드
// ═══════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/permissions'
import { AppError, notFound, forbidden } from '@/lib/errors'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import { generatePayStubPdf, type PayrollItemWithRelations } from '@/lib/payroll/pdf'
import { normaliseDetail } from '@/lib/payroll/normalise-detail'
import { isDomesticCompanyCode } from '@/lib/constants'
import { getRequestLocale } from '@/lib/server-i18n'

// Self-service: query is hard-scoped to user.employeeId/companyId below, so
// withAuth is correct — withPermission(payroll_read) wrongly blocked MANAGER.
export const GET = withAuth(
  async (_req, context, user) => {
    await getRequestLocale()
    // DD-3: Korean legal payslip must be in Korean
    const pdfLocale = 'ko' as const
    const { runId } = await context.params

    // 해외 법인 가드: 정본 급여명세서는 현지 시스템에서 발급된다(assignments.md "현지 시스템 +
    // 데이터 동기화만"). HR Hub는 해외 직원에게 PDF 명세서를 생성하지 않는다. UI가 버튼을
    // 숨겨도 이 엔드포인트가 권위 경계 — 직접 호출도 차단. fail-closed.
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { code: true },
    })
    if (!isDomesticCompanyCode(company?.code)) {
      if (!company) {
        console.warn('[payroll/me/pdf] company not found; blocking payslip PDF (treated as overseas)', {
          companyId: user.companyId,
          employeeId: user.employeeId,
        })
      }
      throw forbidden('급여명세서는 현지 시스템에서 발급됩니다.')
    }

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
