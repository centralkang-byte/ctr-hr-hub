import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import {
  payDeductionTypeListSchema,
  payDeductionTypeCreateSchema,
} from '@/lib/schemas/payroll'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/payroll/deduction-types ─────────────────
// List deduction types for user's company

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = payDeductionTypeListSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, category, isActive } = parsed.data
    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    const where = {
      ...companyFilter,
      ...(category ? { category } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.payDeductionType.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payDeductionType.count({ where }),
    ])

    return apiPaginated(items, buildPagination(page, limit, total))
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)

// ─── POST /api/v1/payroll/deduction-types ────────────────
// Create a new deduction type

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = payDeductionTypeCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const companyId = user.companyId

    try {
      const result = await prisma.payDeductionType.create({
        data: {
          companyId,
          code: parsed.data.code,
          name: parsed.data.name,
          category: parsed.data.category,
          countryCode: parsed.data.countryCode,
          calculationMethod: parsed.data.calculationMethod,
          rate: parsed.data.rate,
          description: parsed.data.description,
          sortOrder: parsed.data.sortOrder,
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'payroll.deduction-type.create',
        resourceType: 'payDeductionType',
        resourceId: result.id,
        companyId: result.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(result, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.CREATE),
)
