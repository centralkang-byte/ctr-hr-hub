// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Shift Pattern API
// GET  /api/v1/shift-patterns  — List shift patterns
// POST /api/v1/shift-patterns  — Create shift pattern
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import {
  shiftPatternCreateSchema,
  shiftPatternSearchSchema,
} from '@/lib/schemas/shift'
import type { SessionUser } from '@/types'

// ─── GET: List shift patterns ──────────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    try {
      const { searchParams } = new URL(req.url)
      const params = Object.fromEntries(searchParams.entries())
      const parsed = shiftPatternSearchSchema.safeParse(params)

      if (!parsed.success) {
        throw badRequest('입력값이 올바르지 않습니다.', {
          issues: parsed.error.issues,
        })
      }

      const { page, limit, patternType, isActive } = parsed.data
      const skip = (page - 1) * limit

      const companyFilter =
        user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

      const where = {
        ...companyFilter,
        ...(patternType ? { patternType } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      }

      const [patterns, total] = await Promise.all([
        prisma.shiftPattern.findMany({
          where,
          include: {
            _count: { select: { shiftGroups: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.shiftPattern.count({ where }),
      ])

      return apiPaginated(patterns, buildPagination(page, limit, total))
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW),
)

// ─── POST: Create shift pattern ──────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    try {
      const body = await req.json()
      const parsed = shiftPatternCreateSchema.safeParse(body)

      if (!parsed.success) {
        throw badRequest('입력값이 올바르지 않습니다.', {
          issues: parsed.error.issues,
        })
      }

      const pattern = await prisma.shiftPattern.create({
        data: {
          companyId: user.companyId,
          code: parsed.data.code,
          name: parsed.data.name,
          patternType: parsed.data.patternType,
          slots: JSON.parse(JSON.stringify(parsed.data.slots)),
          cycleDays: parsed.data.cycleDays,
          weeklyHoursLimit: parsed.data.weeklyHoursLimit ?? null,
          description: parsed.data.description ?? null,
        },
      })

      return apiSuccess(pattern, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.CREATE),
)
