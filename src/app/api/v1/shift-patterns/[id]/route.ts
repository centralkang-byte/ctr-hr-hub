// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Shift Pattern Detail API
// GET    /api/v1/shift-patterns/[id]  — Get pattern detail
// PUT    /api/v1/shift-patterns/[id]  — Update pattern
// DELETE /api/v1/shift-patterns/[id]  — Soft delete pattern
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { shiftPatternUpdateSchema } from '@/lib/schemas/shift'
import type { SessionUser } from '@/types'

// ─── GET: Single pattern with shiftGroups ──────────────────

export const GET = withPermission(
  async (
    _req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const { id } = await context.params

      const companyFilter =
        user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

      const pattern = await prisma.shiftPattern.findFirst({
        where: { id, ...companyFilter },
        include: {
          shiftGroups: {
            where: { isActive: true },
            include: {
              _count: { select: { members: true } },
            },
            orderBy: { name: 'asc' },
          },
        },
      })

      if (!pattern) {
        throw notFound('교대 패턴을 찾을 수 없습니다.')
      }

      return apiSuccess(pattern)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW),
)

// ─── PUT: Update pattern ───────────────────────────────────

export const PUT = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const { id } = await context.params
      const body = await req.json()
      const parsed = shiftPatternUpdateSchema.safeParse(body)

      if (!parsed.success) {
        throw badRequest('입력값이 올바르지 않습니다.', {
          issues: parsed.error.issues,
        })
      }

      const companyFilter =
        user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

      // Verify existence
      const existing = await prisma.shiftPattern.findFirst({
        where: { id, ...companyFilter },
      })

      if (!existing) {
        throw notFound('교대 패턴을 찾을 수 없습니다.')
      }

      const updateData: Record<string, unknown> = {}
      if (parsed.data.code !== undefined) updateData.code = parsed.data.code
      if (parsed.data.name !== undefined) updateData.name = parsed.data.name
      if (parsed.data.patternType !== undefined) updateData.patternType = parsed.data.patternType
      if (parsed.data.slots !== undefined)
        updateData.slots = parsed.data.slots as unknown as Record<string, unknown>[]
      if (parsed.data.cycleDays !== undefined) updateData.cycleDays = parsed.data.cycleDays
      if (parsed.data.weeklyHoursLimit !== undefined)
        updateData.weeklyHoursLimit = parsed.data.weeklyHoursLimit
      if (parsed.data.description !== undefined) updateData.description = parsed.data.description

      const updated = await prisma.shiftPattern.update({
        where: { id },
        data: updateData,
      })

      return apiSuccess(updated)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.APPROVE),
)

// ─── DELETE: Soft delete (set isActive=false) ──────────────

export const DELETE = withPermission(
  async (
    _req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const { id } = await context.params

      const companyFilter =
        user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

      const existing = await prisma.shiftPattern.findFirst({
        where: { id, ...companyFilter },
      })

      if (!existing) {
        throw notFound('교대 패턴을 찾을 수 없습니다.')
      }

      const updated = await prisma.shiftPattern.update({
        where: { id },
        data: { isActive: false },
      })

      return apiSuccess(updated)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.APPROVE),
)
