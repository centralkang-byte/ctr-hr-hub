import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Update schema ───────────────────────────────────────

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  behavioralIndicators: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
})

// ─── Helper: find competency with company scope ──────────

async function findCompetency(id: string, user: SessionUser) {
  const where =
    user.role === ROLE.SUPER_ADMIN
      ? { id }
      : { id, OR: [{ companyId: user.companyId }, { companyId: null }] }

  const competency = await prisma.competencyLibrary.findFirst({
    where,
    include: { company: { select: { id: true, name: true } } },
  })

  if (!competency) throw notFound('역량을 찾을 수 없습니다.')
  return competency
}

// ─── GET /api/v1/competencies/[id] ───────────────────────
// Get single competency

export const GET = withPermission(
  async (
    _req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params
    const competency = await findCompetency(id, user)
    return apiSuccess(competency)
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

// ─── PUT /api/v1/competencies/[id] ───────────────────────
// Update competency (partial)

export const PUT = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      // Verify existence & scope
      await findCompetency(id, user)

      const data: Record<string, unknown> = {}
      if (parsed.data.name !== undefined) data.name = parsed.data.name
      if (parsed.data.category !== undefined) data.category = parsed.data.category
      if (parsed.data.description !== undefined) data.description = parsed.data.description
      if (parsed.data.behavioralIndicators !== undefined)
        data.behavioralIndicators = parsed.data.behavioralIndicators
      if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive

      const result = await prisma.competencyLibrary.update({
        where: { id },
        data,
        include: { company: { select: { id: true, name: true } } },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.competency.update',
        resourceType: 'competency_library',
        resourceId: result.id,
        companyId: user.companyId,
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

// ─── DELETE /api/v1/competencies/[id] ────────────────────
// Hard delete (no deletedAt on this model)

export const DELETE = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    try {
      // Verify existence & scope
      await findCompetency(id, user)

      const result = await prisma.competencyLibrary.delete({
        where: { id },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.competency.delete',
        resourceType: 'competency_library',
        resourceId: result.id,
        companyId: user.companyId,
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
