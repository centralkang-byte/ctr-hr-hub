// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Peer Review Results (Employee)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const querySchema = z.object({
  cycleId: z.string(),
  employeeId: z.string(),
})

// ─── GET /api/v1/peer-review/results ─────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = querySchema.safeParse(params)
    if (!parsed.success) throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })

    const { cycleId, employeeId } = parsed.data

    // Verify cycle belongs to company
    const cycle = await prisma.performanceCycle.findFirst({
      where: { id: cycleId, companyId: user.companyId },
    })
    if (!cycle) throw notFound('평가 주기를 찾을 수 없습니다.')

    // Get all peer evaluations for this employee in this cycle
    const evaluations = await prisma.performanceEvaluation.findMany({
      where: {
        cycleId,
        employeeId,
        evalType: 'PEER',
        status: { in: ['SUBMITTED', 'CONFIRMED'] },
        companyId: user.companyId,
      },
      select: {
        id: true,
        competencyScore: true,
        competencyDetail: true,
        comment: true,
        submittedAt: true,
        evaluator: {
          select: {
            id: true, name: true,
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              include: { department: { select: { name: true } } },
            },
          },
        },
      },
    })

    if (evaluations.length === 0) {
      return apiSuccess({ employeeId, cycleId, evaluations: [], summary: null })
    }

    // Calculate average
    const scores = evaluations.map((e) => Number(e.competencyScore ?? 0))
    const avgScore = scores.reduce((s, v) => s + v, 0) / scores.length

    // Aggregate competency details
    const detailAgg: Record<string, number[]> = {}
    for (const e of evaluations) {
      if (e.competencyDetail && typeof e.competencyDetail === 'object') {
        const detail = e.competencyDetail as Record<string, unknown>
        for (const [key, val] of Object.entries(detail)) {
          if (typeof val === 'number') {
            if (!detailAgg[key]) detailAgg[key] = []
            detailAgg[key].push(val)
          }
        }
      }
    }
    const detailAvg: Record<string, number> = {}
    for (const [key, vals] of Object.entries(detailAgg)) {
      detailAvg[key] = Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100
    }

    return apiSuccess({
      employeeId,
      cycleId,
      evaluations,
      summary: {
        reviewerCount: evaluations.length,
        averageScore: Math.round(avgScore * 100) / 100,
        competencyAvg: detailAvg,
      },
    })
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
