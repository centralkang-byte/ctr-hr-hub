// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/me — 내 급여명세서 목록 (PAID만)
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/permissions'
import { apiSuccess } from '@/lib/api'
import { normaliseDetail } from '@/lib/payroll/normalise-detail'

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

    // Normalise each item's detail to match PayrollItemDetail shape
    const normalised = items.map((item) => {
      const ps = payslipMap.get(item.id)
      return {
        ...item,
        payslipId: ps?.id ?? null,
        isViewed: ps?.isViewed ?? false,
        viewedAt: ps?.viewedAt ?? null,
        detail: normaliseDetail(
          item.detail,
          item.grossPay as unknown as number,
          item.netPay as unknown as number,
        ),
      }
    })

    return apiSuccess(normalised)
  },
)
