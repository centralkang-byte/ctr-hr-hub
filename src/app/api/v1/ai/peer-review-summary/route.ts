// ═══════════════════════════════════════════════════════════
// CTR HR Hub — AI Peer Review Summary
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { generatePeerReviewSummary } from '@/lib/claude'
import type { SessionUser } from '@/types'

const bodySchema = z.object({
  cycleId: z.string(),
  employeeId: z.string(),
})

// ─── POST /api/v1/ai/peer-review-summary ────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body = await req.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 데이터입니다.', { issues: parsed.error.issues })

    const { cycleId, employeeId } = parsed.data

    const cycle = await prisma.performanceCycle.findFirst({
      where: { id: cycleId, companyId: user.companyId },
    })
    if (!cycle) throw notFound('평가 주기를 찾을 수 없습니다.')

    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        assignments: {
          some: { companyId: user.companyId, isPrimary: true, endDate: null },
        },
      },
      select: { name: true },
    })
    if (!employee) throw notFound('직원을 찾을 수 없습니다.')

    // Get peer evaluations
    const evaluations = await prisma.performanceEvaluation.findMany({
      where: {
        cycleId,
        employeeId,
        evalType: 'PEER',
        status: { in: ['SUBMITTED', 'CONFIRMED'] },
        companyId: user.companyId,
      },
      select: {
        competencyScore: true,
        competencyDetail: true,
        comment: true,
      },
    })

    if (evaluations.length === 0) {
      throw badRequest('제출된 동료 평가가 없습니다.')
    }

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
    const competencyAvg: Record<string, number> = {}
    for (const [key, vals] of Object.entries(detailAgg)) {
      competencyAvg[key] = Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100
    }

    const comments = evaluations.map((e) => e.comment).filter((c): c is string => !!c)

    const result = await generatePeerReviewSummary(
      {
        employeeName: employee.name,
        reviewerCount: evaluations.length,
        averageScore: Math.round(avgScore * 100) / 100,
        competencyAvg,
        comments,
      },
      user.companyId,
      user.id,
    )

    return apiSuccess(result)
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
