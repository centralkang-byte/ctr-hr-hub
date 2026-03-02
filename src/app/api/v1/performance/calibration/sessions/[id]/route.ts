// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Calibration Session Detail & Update
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import type { CalibrationStatus } from '@/generated/prisma/client'

// ─── Schema ──────────────────────────────────────────────

const updateSchema = z.object({
  status: z.enum(['CALIBRATION_DRAFT', 'CALIBRATION_IN_PROGRESS', 'CALIBRATION_COMPLETED']).optional(),
  notes: z.string().max(5000).optional(),
  blockDistribution: z.record(z.string(), z.number()).optional(),
})

// ─── GET /api/v1/performance/calibration/sessions/[id] ───

export const GET = withPermission(
  async (_req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const session = await prisma.calibrationSession.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        cycle: { select: { id: true, name: true, year: true, half: true, status: true } },
        department: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        adjustments: {
          include: {
            employee: { select: { id: true, name: true, employeeNo: true } },
            adjuster: { select: { id: true, name: true } },
          },
          orderBy: { adjustedAt: 'desc' },
        },
      },
    })

    if (!session) throw notFound('캘리브레이션 세션을 찾을 수 없습니다.')

    // Get all evaluations for this cycle (and department if scoped)
    const evalWhere = {
      cycleId: session.cycleId,
      companyId: user.companyId,
      evalType: 'MANAGER' as const,
      status: 'SUBMITTED' as const,
      ...(session.departmentId
        ? {
            employee: {
              assignments: {
                some: { departmentId: session.departmentId, isPrimary: true, endDate: null },
              },
            },
          }
        : {}),
    }

    const evaluations = await prisma.performanceEvaluation.findMany({
      where: evalWhere,
      include: {
        employee: {
          select: {
            id: true, name: true, employeeNo: true,
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              include: {
                department: { select: { name: true } },
                jobGrade: { select: { name: true } },
              },
            },
          },
        },
      },
    })

    const mappedEvals = evaluations.map((ev) => ({
      ...ev,
      performanceScore: ev.performanceScore ? Number(ev.performanceScore) : null,
      competencyScore: ev.competencyScore ? Number(ev.competencyScore) : null,
    }))

    const mappedAdjustments = session.adjustments.map((adj) => ({
      ...adj,
      originalPerformanceScore: Number(adj.originalPerformanceScore),
      originalCompetencyScore: Number(adj.originalCompetencyScore),
      adjustedPerformanceScore: Number(adj.adjustedPerformanceScore),
      adjustedCompetencyScore: Number(adj.adjustedCompetencyScore),
    }))

    return apiSuccess({
      ...session,
      adjustments: mappedAdjustments,
      evaluations: mappedEvals,
    })
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)

// ─── PUT /api/v1/performance/calibration/sessions/[id] ───

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const existing = await prisma.calibrationSession.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!existing) throw notFound('캘리브레이션 세션을 찾을 수 없습니다.')

    try {
      const session = await prisma.calibrationSession.update({
        where: { id },
        data: {
          ...(parsed.data.status ? { status: parsed.data.status as CalibrationStatus } : {}),
          ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
          ...(parsed.data.blockDistribution ? { blockDistribution: parsed.data.blockDistribution } : {}),
          ...(parsed.data.status === 'CALIBRATION_COMPLETED' ? { completedAt: new Date() } : {}),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.calibration_session.update',
        resourceType: 'calibrationSession',
        resourceId: id,
        companyId: user.companyId,
        changes: parsed.data,
        ip,
        userAgent,
      })

      return apiSuccess(session)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
