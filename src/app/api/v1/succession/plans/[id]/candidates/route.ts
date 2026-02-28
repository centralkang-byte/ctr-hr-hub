// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Succession Candidate List & Add
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { candidateAddSchema } from '@/lib/schemas/succession'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/succession/plans/[id]/candidates ───────

export const GET = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    const plan = await prisma.successionPlan.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!plan) throw notFound('후계 계획을 찾을 수 없습니다.')

    const candidates = await prisma.successionCandidate.findMany({
      where: { planId: id },
      include: {
        employee: { select: { id: true, name: true, employeeNo: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return apiSuccess(candidates)
  },
  perm(MODULE.SUCCESSION, ACTION.VIEW),
)

// ─── POST /api/v1/succession/plans/[id]/candidates ──────

export const POST = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = candidateAddSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const plan = await prisma.successionPlan.findFirst({
        where: { id, companyId: user.companyId },
      })
      if (!plan) throw notFound('후계 계획을 찾을 수 없습니다.')

      const candidate = await prisma.successionCandidate.create({
        data: {
          planId: id,
          nominatedBy: user.employeeId,
          ...parsed.data,
        },
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'succession.candidate.add',
        resourceType: 'successionCandidate',
        resourceId: candidate.id,
        companyId: user.companyId,
        changes: { planId: id, employeeId: parsed.data.employeeId },
        ip,
        userAgent,
      })

      return apiSuccess(candidate, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SUCCESSION, ACTION.CREATE),
)
