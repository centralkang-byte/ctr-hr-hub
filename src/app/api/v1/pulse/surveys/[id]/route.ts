// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Pulse Survey Detail / Update / Delete
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Schemas ──────────────────────────────────────────────

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  targetScope: z.enum(['ALL', 'DIVISION', 'DEPARTMENT', 'TEAM']).optional(),
  targetIds: z.array(z.string()).optional(),
  anonymityLevel: z.enum(['FULL_DIVISION', 'FULL_ANONYMOUS']).optional(),
  minRespondentsForReport: z.number().int().min(1).optional(),
  openAt: z.string().datetime().optional(),
  closeAt: z.string().datetime().optional(),
  status: z.enum(['PULSE_DRAFT', 'PULSE_ACTIVE', 'PULSE_CLOSED']).optional(),
})

// ─── GET /api/v1/pulse/surveys/[id] ──────────────────────

export const GET = withPermission(
  async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    const survey = await prisma.pulseSurvey.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
        creator: { select: { id: true, name: true } },
        _count: { select: { responses: true } },
      },
    })

    if (!survey) throw notFound('설문을 찾을 수 없습니다.')
    return apiSuccess(survey)
  },
  perm(MODULE.PULSE, ACTION.VIEW),
)

// ─── PUT /api/v1/pulse/surveys/[id] ──────────────────────

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 데이터입니다.', { issues: parsed.error.issues })

    const existing = await prisma.pulseSurvey.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    })
    if (!existing) throw notFound('설문을 찾을 수 없습니다.')

    const data: Record<string, unknown> = { ...parsed.data }
    if (data.openAt) data.openAt = new Date(data.openAt as string)
    if (data.closeAt) data.closeAt = new Date(data.closeAt as string)

    try {
      const updated = await prisma.pulseSurvey.update({
        where: { id },
        data,
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        action: 'PULSE_SURVEY_UPDATED',
        actorId: user.employeeId,
        companyId: user.companyId,
        resourceType: 'PulseSurvey',
        resourceId: id,
        ip,
        userAgent,
      })

      return apiSuccess(updated)
    } catch (err) {
      throw handlePrismaError(err)
    }
  },
  perm(MODULE.PULSE, ACTION.UPDATE),
)

// ─── DELETE /api/v1/pulse/surveys/[id] (soft) ────────────

export const DELETE = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    const existing = await prisma.pulseSurvey.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    })
    if (!existing) throw notFound('설문을 찾을 수 없습니다.')

    await prisma.pulseSurvey.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      action: 'PULSE_SURVEY_DELETED',
      actorId: user.employeeId,
      companyId: user.companyId,
      resourceType: 'PulseSurvey',
      resourceId: id,
      ip,
      userAgent,
    })

    return apiSuccess({ deleted: true })
  },
  perm(MODULE.PULSE, ACTION.DELETE),
)
