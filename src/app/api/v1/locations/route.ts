import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, withAuth, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Validation Schemas ──────────────────────────────────

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  companyId: z.string().optional(),
  locationType: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
})

const createSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  nameEn: z.string().max(100).optional(),
  country: z.string().min(2).max(2),
  city: z.string().max(100).optional(),
  timezone: z.string().min(1).max(50),
  address: z.string().max(500).optional(),
  locationType: z.string().max(30).optional(),
  companyId: z.string().optional(),
})

// ─── GET /api/v1/locations ───────────────────────────────
// List locations (all authenticated users, company-scoped)

export const GET = withAuth(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = searchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, search, companyId, locationType, isActive } = parsed.data

    // Company scoping: SUPER_ADMIN can see all or filter by companyId
    // Others: forced to their own company
    const effectiveCompanyId =
      user.role === ROLE.SUPER_ADMIN
        ? companyId || undefined // undefined = all companies
        : user.companyId

    const where = {
      deletedAt: null,
      ...(effectiveCompanyId ? { companyId: effectiveCompanyId } : {}),
      ...(locationType ? { locationType } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' as const } },
              { name: { contains: search, mode: 'insensitive' as const } },
              { nameEn: { contains: search, mode: 'insensitive' as const } },
              { city: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [locations, total] = await Promise.all([
      prisma.workLocation.findMany({
        where,
        include: {
          company: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ company: { code: 'asc' } }, { code: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.workLocation.count({ where }),
    ])

    return apiPaginated(locations, buildPagination(page, limit, total))
  },
)

// ─── POST /api/v1/locations ──────────────────────────────
// Create location (HR_ADMIN+ for own company, SUPER_ADMIN for any)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const effectiveCompanyId =
      user.role === ROLE.SUPER_ADMIN && parsed.data.companyId
        ? parsed.data.companyId
        : user.companyId

    try {
      const result = await prisma.workLocation.create({
        data: {
          companyId: effectiveCompanyId,
          code: parsed.data.code,
          name: parsed.data.name,
          nameEn: parsed.data.nameEn,
          country: parsed.data.country,
          city: parsed.data.city,
          timezone: parsed.data.timezone,
          address: parsed.data.address,
          locationType: parsed.data.locationType,
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'org.location.create',
        resourceType: 'workLocation',
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
  perm(MODULE.ORG, ACTION.APPROVE),
)
