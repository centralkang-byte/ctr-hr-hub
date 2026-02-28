import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { leavePolicyCreateSchema } from '@/lib/schemas/leave'
import { paginationSchema } from '@/lib/schemas/common'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/leave/policies ──────────────────────────
// List leave policies (with optional filters)

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = paginationSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit } = parsed.data
    const isActive = params.isActive === 'true' ? true : params.isActive === 'false' ? false : undefined
    const leaveType = params.leaveType || undefined

    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    const where = {
      ...companyFilter,
      deletedAt: null,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(leaveType ? { leaveType: leaveType as never } : {}),
    }

    const [policies, total] = await Promise.all([
      prisma.leavePolicy.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.leavePolicy.count({ where }),
    ])

    return apiPaginated(policies, buildPagination(page, limit, total))
  },
  perm(MODULE.LEAVE, ACTION.VIEW),
)

// ─── POST /api/v1/leave/policies ─────────────────────────
// Create a leave policy

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = leavePolicyCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const effectiveCompanyId =
      user.role === 'SUPER_ADMIN'
        ? ((body as Record<string, unknown>).companyId as string) ?? user.companyId
        : user.companyId

    try {
      const result = await prisma.leavePolicy.create({
        data: {
          companyId: effectiveCompanyId,
          name: parsed.data.name,
          leaveType: parsed.data.leaveType as never,
          defaultDays: parsed.data.defaultDays,
          isPaid: parsed.data.isPaid,
          carryOverAllowed: parsed.data.carryOverAllowed,
          ...(parsed.data.maxCarryOverDays !== undefined && {
            maxCarryOverDays: parsed.data.maxCarryOverDays,
          }),
          ...(parsed.data.minTenureMonths !== undefined && {
            minTenureMonths: parsed.data.minTenureMonths,
          }),
          minUnit: parsed.data.minUnit,
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'leave.policy.create',
        resourceType: 'leavePolicy',
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
  perm(MODULE.LEAVE, ACTION.APPROVE),
)
