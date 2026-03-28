import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { taxBracketUpdateSchema } from '@/lib/schemas/tax-bracket'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/tax-brackets/[id] ──────────────────────
// Single tax bracket detail

export const GET = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const bracket = await prisma.taxBracket.findFirst({
      where: { id, ...companyFilter },
    })

    if (!bracket) throw notFound('세금 구간을 찾을 수 없습니다.')

    return apiSuccess(bracket)
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

// ─── PUT /api/v1/tax-brackets/[id] ──────────────────────
// Update tax bracket

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = taxBracketUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    try {
      const existing = await prisma.taxBracket.findFirst({
        where: { id, ...companyFilter },
      })
      if (!existing) throw notFound('세금 구간을 찾을 수 없습니다.')

      const result = await prisma.taxBracket.update({
        where: { id },
        data: {
          ...(parsed.data.name !== undefined && { name: parsed.data.name }),
          ...(parsed.data.bracketMin !== undefined && { bracketMin: parsed.data.bracketMin }),
          ...(parsed.data.bracketMax !== undefined && { bracketMax: parsed.data.bracketMax ?? null }),
          ...(parsed.data.rate !== undefined && { rate: parsed.data.rate }),
          ...(parsed.data.fixedAmount !== undefined && { fixedAmount: parsed.data.fixedAmount }),
          ...(parsed.data.effectiveFrom !== undefined && { effectiveFrom: new Date(parsed.data.effectiveFrom) }),
          ...(parsed.data.effectiveTo !== undefined && { effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null }),
          ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.tax_bracket.update',
        resourceType: 'tax_bracket',
        resourceId: result.id,
        companyId: result.companyId,
        changes: JSON.parse(JSON.stringify(parsed.data)),
        ip,
        userAgent,
      })

      return apiSuccess(result)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)

// ─── DELETE /api/v1/tax-brackets/[id] ────────────────────
// Soft delete (set isActive = false)

export const DELETE = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    try {
      const existing = await prisma.taxBracket.findFirst({
        where: { id, ...companyFilter },
      })
      if (!existing) throw notFound('세금 구간을 찾을 수 없습니다.')

      const result = await prisma.taxBracket.update({
        where: { id },
        data: { deletedAt: new Date() },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.tax_bracket.delete',
        resourceType: 'tax_bracket',
        resourceId: result.id,
        companyId: result.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({ id: result.id })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.DELETE),
)
