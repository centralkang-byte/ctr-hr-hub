// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/payslips — 급여명세서 목록
// ?year=2025&month=3  (HR: 법인 전체, Employee: 본인만)
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'
import { apiPaginated, buildPagination } from '@/lib/api'
import { z } from 'zod'

const querySchema = z.object({
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  employeeId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
})

export const GET = withPermission(
  async (req, _context, user) => {
    const { searchParams } = new URL(req.url)
    const params = querySchema.parse({
      year: searchParams.get('year') ?? undefined,
      month: searchParams.get('month') ?? undefined,
      employeeId: searchParams.get('employeeId') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })

    const isHR = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN
    const { page, limit } = params

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

    const [total, payslips] = await Promise.all([
      prisma.payslip.count({ where }),
      prisma.payslip.findMany({
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
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return apiPaginated(payslips, buildPagination(page, limit, total))
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)
