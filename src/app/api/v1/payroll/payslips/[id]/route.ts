// ═══════════════════════════════════════════════════════════
// PATCH /api/v1/payroll/payslips/[id]/viewed — 열람 처리
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { notFound, forbidden } from '@/lib/errors'

export const PATCH = withPermission(
  async (_req, context, user) => {
    const { id } = await context.params

    const payslip = await prisma.payslip.findUnique({ where: { id } })
    if (!payslip) throw notFound('급여명세서를 찾을 수 없습니다.')
    if (payslip.companyId !== user.companyId) throw forbidden()

    // 본인 명세서만 열람 처리 (HR은 모두 가능)
    const isOwnPayslip = payslip.employeeId === user.employeeId
    const isHR = user.role === 'HR_ADMIN' || user.role === 'SUPER_ADMIN'
    if (!isOwnPayslip && !isHR) throw forbidden()

    const updated = await prisma.payslip.update({
      where: { id },
      data: {
        isViewed: true,
        viewedAt: payslip.viewedAt ?? new Date(),
      },
    })

    return apiSuccess(updated)
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)
