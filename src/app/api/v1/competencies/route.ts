import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Search params schema ────────────────────────────────

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  search: z.string().optional(),
  category: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
})

// ─── Create schema ───────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1, '역량명은 필수입니다.'),
  category: z.string().min(1, '카테고리는 필수입니다.'),
  description: z.string().optional(),
  behavioralIndicators: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
})

// ─── GET /api/v1/competencies ────────────────────────────
// List competencies with pagination, search, filter

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = searchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, search, category, isActive } = parsed.data

    // SUPER_ADMIN sees all, others see own company + global (null companyId)
    const companyFilter =
      user.role === ROLE.SUPER_ADMIN
        ? {}
        : { OR: [{ companyId: user.companyId }, { companyId: null }] }

    const where = {
      ...companyFilter,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { category: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(category ? { category } : {}),
      ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
    }

    const [competencies, total] = await Promise.all([
      prisma.competencyLibrary.findMany({
        where,
        include: { company: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.competencyLibrary.count({ where }),
    ])

    return apiPaginated(competencies, buildPagination(page, limit, total))
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

// ─── POST /api/v1/competencies ───────────────────────────
// Create new competency

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const result = await prisma.competencyLibrary.create({
        data: {
          companyId: user.companyId,
          name: parsed.data.name,
          category: parsed.data.category,
          description: parsed.data.description ?? null,
          behavioralIndicators: parsed.data.behavioralIndicators ?? [],
          isActive: parsed.data.isActive,
        },
        include: { company: { select: { id: true, name: true } } },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.competency.create',
        resourceType: 'competency_library',
        resourceId: result.id,
        companyId: user.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(result, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.CREATE),
)
