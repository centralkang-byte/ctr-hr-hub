// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/me — 내 급여명세서 목록 (PAID만)
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/permissions'
import { apiSuccess } from '@/lib/api'
import { normaliseDetail } from '@/lib/payroll/normalise-detail'
import { isDomesticCompanyCode } from '@/lib/constants'

// Self-service: any authenticated user reads ONLY their own payslips.
// Query is hard-scoped to user.employeeId/companyId below, so withAuth is
// correct here — withPermission(payroll_read) wrongly blocked MANAGER, whom
// rbac-spec + sidebar already treat as ALL_ROLES self-service.
export const GET = withAuth(
  async (_req, _context, user) => {
    const items = await prisma.payrollItem.findMany({
      where: {
        employeeId: user.employeeId,
        run: {
          companyId: user.companyId,
          status: { in: ['APPROVED', 'PAID'] },
        },
      },
      include: {
        run: {
          select: {
            id: true,
            name: true,
            yearMonth: true,
            periodStart: true,
            periodEnd: true,
            payDate: true,
            paidAt: true,
          },
        },
      },
      orderBy: { run: { periodEnd: 'desc' } },
    })

    // Payslip 열람 여부 조회
    const payrollItemIds = items.map((i) => i.id)
    const payslips = await prisma.payslip.findMany({
      where: {
        payrollItemId: { in: payrollItemIds },
        employeeId: user.employeeId,
      },
      select: { payrollItemId: true, isViewed: true, viewedAt: true, id: true },
    })
    const payslipMap = new Map(payslips.map((p) => [p.payrollItemId, p]))

    // 해외 법인 가드: 해외 급여는 "현지 시스템 + 데이터 동기화만"(assignments.md)이라
    // 정본 명세서는 현지에서 발급된다. HR Hub는 항목분해(detail)를 노출하지 않는다.
    // SessionUser엔 회사 code가 없어 1회 조회. fail-closed — 미해석 시 해외로 간주(차단).
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { code: true },
    })
    if (!company) {
      console.warn('[payroll/me] company not found; treating as overseas (payslip itemization withheld)', {
        companyId: user.companyId,
        employeeId: user.employeeId,
      })
    }
    const isOverseas = !isDomesticCompanyCode(company?.code)

    // Normalise each item's detail to match PayrollItemDetail shape.
    // 해외: detail=null + payslipAvailable=false (틀린 항목구조를 응답에서 제거).
    // gross/net/총공제 스칼라는 정상 동기화값이므로 그대로 유지(요약 표시용).
    const normalised = items.map((item) => {
      const ps = payslipMap.get(item.id)
      return {
        ...item,
        payslipId: ps?.id ?? null,
        isViewed: ps?.isViewed ?? false,
        viewedAt: ps?.viewedAt ?? null,
        payslipAvailable: !isOverseas,
        detail: isOverseas
          ? null
          : normaliseDetail(
              item.detail,
              item.grossPay as unknown as number,
              item.netPay as unknown as number,
            ),
      }
    })

    return apiSuccess(normalised)
  },
)
