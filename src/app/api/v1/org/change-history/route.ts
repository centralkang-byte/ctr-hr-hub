// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/org/change-history
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { paginationSchema } from '@/lib/schemas/common'
import { z } from 'zod'
import type { SessionUser } from '@/types'

const uuidSchema = z.string().uuid()

// ─── GET /api/v1/org/change-history ───────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = paginationSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit } = parsed.data

    // Optional companyId filter (SUPER_ADMIN only) — validate UUID format
    const rawCompanyId = req.nextUrl.searchParams.get('companyId')
    if (rawCompanyId && !uuidSchema.safeParse(rawCompanyId).success) {
      throw badRequest('companyId는 유효한 UUID여야 합니다.')
    }

    const companyFilter =
      user.role === 'SUPER_ADMIN'
        ? rawCompanyId
          ? { companyId: rawCompanyId }
          : {}
        : { companyId: user.companyId }

    const where = { ...companyFilter }

    try {
      const [history, total] = await Promise.all([
        prisma.orgChangeHistory.findMany({
          where,
          include: {
            approver: { select: { id: true, name: true } },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.orgChangeHistory.count({ where }),
      ])

      return apiPaginated(history, buildPagination(page, limit, total))
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ORG, ACTION.VIEW),
)
