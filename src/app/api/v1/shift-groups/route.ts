// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Shift Group API
// GET  /api/v1/shift-groups  — List groups for a pattern
// POST /api/v1/shift-groups  — Create shift group
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, notFound, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { shiftGroupCreateSchema } from '@/lib/schemas/shift'
import type { SessionUser } from '@/types'

// ─── GET: List groups for a pattern ─────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    try {
      const { searchParams } = new URL(req.url)
      const shiftPatternId = searchParams.get('shiftPatternId')

      if (!shiftPatternId) {
        throw badRequest('shiftPatternId는 필수입니다.')
      }

      const page = Math.max(1, Number(searchParams.get('page') ?? 1))
      const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))
      const skip = (page - 1) * limit

      const companyFilter =
        user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

      const where = {
        shiftPatternId,
        isActive: true,
        ...companyFilter,
      }

      const [groups, total] = await Promise.all([
        prisma.shiftGroup.findMany({
          where,
          include: {
            _count: {
              select: {
                members: { where: { removedAt: null } },
              },
            },
            shiftPattern: {
              select: { name: true, code: true, patternType: true },
            },
          },
          orderBy: { name: 'asc' },
          skip,
          take: limit,
        }),
        prisma.shiftGroup.count({ where }),
      ])

      return apiPaginated(groups, buildPagination(page, limit, total))
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW),
)

// ─── POST: Create shift group ───────────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    try {
      const body = await req.json()
      const parsed = shiftGroupCreateSchema.safeParse(body)

      if (!parsed.success) {
        throw badRequest('입력값이 올바르지 않습니다.', {
          issues: parsed.error.issues,
        })
      }

      // Verify the pattern exists and belongs to user's company
      const companyFilter =
        user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

      const pattern = await prisma.shiftPattern.findFirst({
        where: { id: parsed.data.shiftPatternId, ...companyFilter },
      })

      if (!pattern) {
        throw notFound('교대 패턴을 찾을 수 없습니다.')
      }

      const group = await prisma.shiftGroup.create({
        data: {
          companyId: user.companyId,
          shiftPatternId: parsed.data.shiftPatternId,
          name: parsed.data.name,
          color: parsed.data.color ?? null,
        },
      })

      return apiSuccess(group, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.CREATE),
)
