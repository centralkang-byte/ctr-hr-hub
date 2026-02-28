import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { holidaySearchSchema, holidayCreateSchema } from '@/lib/schemas/holiday'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/holidays ─────────────────────────────────
// List holidays for company + year (with pagination)

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = holidaySearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, year } = parsed.data
    const companyId = user.companyId

    const where = {
      companyId,
      deletedAt: null,
      ...(year ? { year } : {}),
    }

    const [holidays, total] = await Promise.all([
      prisma.holiday.findMany({
        where,
        orderBy: { date: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.holiday.count({ where }),
    ])

    return apiPaginated(holidays, buildPagination(page, limit, total))
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW),
)

// ─── POST /api/v1/holidays ────────────────────────────────
// Create a holiday (HR_ADMIN+)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = holidayCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const effectiveCompanyId =
      user.role === 'SUPER_ADMIN'
        ? ((parsed.data as Record<string, unknown>).companyId as string) ?? user.companyId
        : user.companyId

    try {
      const result = await prisma.holiday.create({
        data: {
          companyId: effectiveCompanyId,
          name: parsed.data.name,
          date: new Date(parsed.data.date),
          isSubstitute: parsed.data.isSubstitute,
          year: parsed.data.year,
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'attendance.holiday.create',
        resourceType: 'holiday',
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
  perm(MODULE.ATTENDANCE, ACTION.CREATE),
)
