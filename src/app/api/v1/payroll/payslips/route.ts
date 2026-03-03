// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/payslips — 급여명세서 목록
// ?year=2025&month=3  (HR: 법인 전체, Employee: 본인만)
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { z } from 'zod'

const querySchema = z.object({
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  employeeId: z.string().uuid().optional(),
})

export const GET = withPermission(
  async (req, _context, user) => {
    const { searchParams } = new URL(req.url)
    const params = querySchema.parse({
      year: searchParams.get('year'),
      month: searchParams.get('month'),
      employeeId: searchParams.get('employeeId'),
    })

    const isHR = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN

    const where: Record<string, unknown> = {
      companyId: user.companyId,
    }

    if (params.year) where.year = params.year
    if (params.month) where.month = params.month

    // 직원은 본인 명세서만 조회
    if (!isHR) {
      where.employeeId = user.employeeId
    } else if (params.employeeId) {
      where.employeeId = params.employeeId
    }

    const payslips = await prisma.payslip.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNo: true,
          },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })

    return apiSuccess(payslips)
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)
