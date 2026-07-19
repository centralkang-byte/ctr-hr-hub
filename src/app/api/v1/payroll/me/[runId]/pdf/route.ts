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

// Self-service: query is hard-scoped to user.employeeId below, so
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
          status: 'PAID',
        },
      },
      include: {
        employee: {
          select: {
            name: true,
            employeeNo: true,
          },
        },
        run: {
          select: {
            companyId: true,
            name: true,
            yearMonth: true,
            periodStart: true,
            periodEnd: true,
            payDate: true,
            company: { select: { code: true, name: true } },
          },
        },
      },
    })

    if (!item) throw notFound('급여명세서를 찾을 수 없습니다.')

    // 해외 법인 가드: 현재 소속이 아니라 급여 실행에 저장된 법인 기준으로 판단한다.
    // 정본 급여명세서는 현지 시스템에서 발급되므로 HR Hub PDF 생성을 차단한다.
    if (!isDomesticCompanyCode(item.run.company.code)) {
      throw forbidden('급여명세서는 현지 시스템에서 발급됩니다.')
    }

    // periodEnd는 inclusive business date이므로 급여 기간의 마지막 날을 포함해
    // 겹치는 같은 법인의 Primary Assignment를 사용한다.
    // 전적 후 현재 발령을 쓰면 과거 명세서의 법인/부서/직급이 왜곡된다.
    const assignments = await prisma.employeeAssignment.findMany({
      where: {
        employeeId: item.employeeId,
        companyId: item.run.companyId,
        isPrimary: true,
        effectiveDate: { lte: item.run.periodEnd },
        OR: [
          { endDate: null },
          { endDate: { gt: item.run.periodStart } },
        ],
      },
      orderBy: { effectiveDate: 'desc' },
      take: 1,
      select: {
        isPrimary: true,
        effectiveDate: true,
        endDate: true,
        department: { select: { name: true } },
        jobGrade: { select: { name: true } },
      },
    })

    // Adapt the Prisma result to generatePayStubPdf's contract:
    //  - department/jobGrade live under the payroll-period primary assignment,
    //    while company comes from the persisted PayrollRun owner. The generator
    //    reads all three flat off `employee`.
    //  - detail is stored raw (engine {earnings,insurance,tax} or legacy
    //    {components,deductions}); the generator expects the normalised shape.
    // Skipping either adaptation is what made this endpoint 500 for every role.
    const primary = extractPrimaryAssignment(assignments)
    const pdfInput: PayrollItemWithRelations = {
      ...item,
      detail: normaliseDetail(item.detail, Number(item.grossPay), Number(item.netPay)),
      employee: {
        name: item.employee.name,
        employeeNo: item.employee.employeeNo,
        department: { name: primary?.department?.name ?? '-' },
        jobGrade: { name: primary?.jobGrade?.name ?? '-' },
        company: { name: item.run.company.name },
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
