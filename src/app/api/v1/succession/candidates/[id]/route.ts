// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Succession Candidate Update & Delete
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { candidateUpdateSchema } from '@/lib/schemas/succession'
import type { SessionUser } from '@/types'

// ─── PUT /api/v1/succession/candidates/[id] ─────────────

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = candidateUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const existing = await prisma.successionCandidate.findFirst({
        where: { id },
        include: { plan: { select: { companyId: true } } },
      })
      if (!existing || existing.plan.companyId !== user.companyId) {
        throw notFound('후보자를 찾을 수 없습니다.')
      }

      const data = parsed.data
      const result = await prisma.successionCandidate.update({
        where: { id },
        data: {
          ...(data.readiness !== undefined && { readiness: data.readiness }),
          ...(data.developmentAreas !== undefined && { developmentAreas: data.developmentAreas }),
          ...(data.notes !== undefined && { notes: data.notes }),
        },
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'succession.candidate.update',
        resourceType: 'successionCandidate',
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
  perm(MODULE.SUCCESSION, ACTION.UPDATE),
)

// ─── DELETE /api/v1/succession/candidates/[id] ──────────

export const DELETE = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    try {
      const existing = await prisma.successionCandidate.findFirst({
        where: { id },
        include: { plan: { select: { companyId: true } } },
      })
      if (!existing || existing.plan.companyId !== user.companyId) {
        throw notFound('후보자를 찾을 수 없습니다.')
      }

      await prisma.successionCandidate.delete({ where: { id } })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'succession.candidate.delete',
        resourceType: 'successionCandidate',
        resourceId: id,
        companyId: user.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({ id })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SUCCESSION, ACTION.DELETE),
)
