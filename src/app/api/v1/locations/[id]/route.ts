import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, withAuth, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  nameEn: z.string().max(100).optional(),
  country: z.string().min(2).max(2).optional(),
  city: z.string().max(100).optional(),
  timezone: z.string().min(1).max(50).optional(),
  address: z.string().max(500).optional(),
  locationType: z.string().max(30).optional(),
  isActive: z.boolean().optional(),
})

// ─── GET /api/v1/locations/[id] ──────────────────────────

export const GET = withAuth(
  async (_req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const location = await prisma.workLocation.findUnique({
      where: { id, deletedAt: null },
      include: {
        company: { select: { id: true, code: true, name: true } },
      },
    })

    if (!location) {
      throw notFound('근무지를 찾을 수 없습니다.')
    }

    // Non-SUPER_ADMIN can only view own company locations
    if (user.role !== ROLE.SUPER_ADMIN && location.companyId !== user.companyId) {
      throw notFound('근무지를 찾을 수 없습니다.')
    }

    return apiSuccess(location)
  },
)

// ─── PUT /api/v1/locations/[id] ──────────────────────────

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const existing = await prisma.workLocation.findUnique({ where: { id, deletedAt: null } })
    if (!existing) {
      throw notFound('근무지를 찾을 수 없습니다.')
    }

    // HR_ADMIN can only update own company
    if (user.role !== ROLE.SUPER_ADMIN && existing.companyId !== user.companyId) {
      throw notFound('근무지를 찾을 수 없습니다.')
    }

    try {
      const result = await prisma.workLocation.update({
        where: { id },
        data: parsed.data,
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'org.location.update',
        resourceType: 'workLocation',
        resourceId: result.id,
        companyId: result.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(result)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ORG, ACTION.APPROVE),
)

// ─── DELETE /api/v1/locations/[id] ───────────────────────
// Soft delete (set isActive = false)

export const DELETE = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const existing = await prisma.workLocation.findUnique({ where: { id, deletedAt: null } })
    if (!existing) {
      throw notFound('근무지를 찾을 수 없습니다.')
    }

    if (user.role !== ROLE.SUPER_ADMIN && existing.companyId !== user.companyId) {
      throw notFound('근무지를 찾을 수 없습니다.')
    }

    try {
      const result = await prisma.workLocation.update({
        where: { id },
        data: { deletedAt: new Date() },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'org.location.deactivate',
        resourceType: 'workLocation',
        resourceId: result.id,
        companyId: result.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({ id, deletedAt: new Date() })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ORG, ACTION.APPROVE),
)
