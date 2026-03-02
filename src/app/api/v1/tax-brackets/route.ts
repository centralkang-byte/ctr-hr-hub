import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { taxBracketListSchema, taxBracketCreateSchema } from '@/lib/schemas/tax-bracket'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/tax-brackets ────────────────────────────
// Paginated list with optional countryCode, taxType, isActive filters

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = taxBracketListSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, countryCode, taxType, isActive } = parsed.data
    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const where = {
      ...companyFilter,
      ...(countryCode ? { countryCode } : {}),
      ...(taxType ? { taxType } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    }

    const [brackets, total] = await Promise.all([
      prisma.taxBracket.findMany({
        where,
        orderBy: [
          { countryCode: 'asc' },
          { taxType: 'asc' },
          { bracketMin: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.taxBracket.count({ where }),
    ])

    return apiPaginated(brackets, buildPagination(page, limit, total))
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

// ─── POST /api/v1/tax-brackets ───────────────────────────
// Create a single tax bracket

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = taxBracketCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const effectiveCompanyId =
      user.role === ROLE.SUPER_ADMIN
        ? ((body as Record<string, unknown>).companyId as string) ?? user.companyId
        : user.companyId

    try {
      const result = await prisma.taxBracket.create({
        data: {
          companyId: effectiveCompanyId,
          countryCode: parsed.data.countryCode,
          taxType: parsed.data.taxType,
          name: parsed.data.name,
          bracketMin: parsed.data.bracketMin,
          bracketMax: parsed.data.bracketMax ?? null,
          rate: parsed.data.rate,
          fixedAmount: parsed.data.fixedAmount,
          effectiveFrom: new Date(parsed.data.effectiveFrom),
          effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null,
          description: parsed.data.description ?? null,
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.tax_bracket.create',
        resourceType: 'tax_bracket',
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
  perm(MODULE.SETTINGS, ACTION.CREATE),
)
