// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Quarterly Review Dashboard
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Validation ─────────────────────────────────────────────

const dashboardSchema = z.object({
  year: z.coerce.number().int(),
  quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']).optional(),
})

// ─── GET /api/v1/performance/quarterly-reviews/dashboard ────
// Aggregated stats for quarterly reviews (Manager/HR/Super only).

export const GET = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const url = new URL(req.url)
    const params = dashboardSchema.parse({
      year: url.searchParams.get('year'),
      quarter: url.searchParams.get('quarter') ?? undefined,
    })
    const { year, quarter } = params

    // Role scoping
    if (user.role === ROLE.EMPLOYEE) {
      throw forbidden('대시보드 접근 권한이 없습니다.')
    }

    type WhereClause = {
      managerId?: string
      companyId?: string
      year: number
      quarter?: string
    }

    let baseWhere: WhereClause

    if (user.role === ROLE.MANAGER) {
      baseWhere = {
        managerId: user.employeeId,
        companyId: user.companyId,
        year,
        ...(quarter ? { quarter } : {}),
      }
    } else if (user.role === ROLE.SUPER_ADMIN) {
      // SUPER_ADMIN: companyId filter optional
      baseWhere = {
        year,
        ...(quarter ? { quarter } : {}),
      }
    } else {
      // HR_ADMIN, EXECUTIVE
      baseWhere = {
        companyId: user.companyId,
        year,
        ...(quarter ? { quarter } : {}),
      }
    }

    // Three parallel groupBy queries
    const [statusDist, sentimentDist, goalTrackingDist] = await Promise.all([
      prisma.quarterlyReview.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: true,
      }),
      prisma.quarterlyReview.groupBy({
        by: ['overallSentiment'],
        where: {
          ...baseWhere,
          status: 'COMPLETED',
          overallSentiment: { not: null },
        },
        _count: true,
      }),
      prisma.quarterlyGoalProgress.groupBy({
        by: ['trackingStatus'],
        where: {
          quarterlyReview: baseWhere,
          trackingStatus: { not: null },
        },
        _count: true,
      }),
    ])

    // Compute summary metrics
    const totalReviews = statusDist.reduce((sum, s) => sum + s._count, 0)
    const completedCount = statusDist.find((s) => s.status === 'COMPLETED')?._count ?? 0
    const completionRate = totalReviews > 0
      ? Math.round((completedCount / totalReviews) * 10000) / 100
      : 0

    // Transform distributions
    const statusDistribution = statusDist.map((s) => ({
      status: s.status,
      count: s._count,
    }))

    const sentimentDistribution = sentimentDist.map((s) => ({
      sentiment: s.overallSentiment,
      count: s._count,
    }))

    const goalTrackingDistribution = goalTrackingDist.map((g) => ({
      trackingStatus: g.trackingStatus,
      count: g._count,
    }))

    return apiSuccess({
      totalReviews,
      completionRate,
      statusDistribution,
      sentimentDistribution,
      goalTrackingDistribution,
    })
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
