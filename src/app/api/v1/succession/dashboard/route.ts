// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Succession Dashboard KPIs
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/succession/dashboard ───────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const companyId = user.companyId

    const [totalPlans, activePlans, criticalPlans, plansWithCandidates, readinessDistribution] =
      await Promise.all([
        prisma.successionPlan.count({ where: { companyId } }),
        prisma.successionPlan.count({ where: { companyId, status: 'PLAN_ACTIVE' } }),
        prisma.successionPlan.count({ where: { companyId, criticality: { in: ['HIGH', 'CRITICAL'] } } }),
        prisma.successionPlan.count({
          where: { companyId, candidates: { some: {} } },
        }),
        prisma.successionCandidate.groupBy({
          by: ['readiness'],
          where: { plan: { companyId } },
          _count: true,
        }),
      ])

    const plansWithoutCandidates = totalPlans - plansWithCandidates

    const readiness = readinessDistribution.map((r) => ({
      readiness: r.readiness,
      count: r._count,
    }))

    return apiSuccess({
      totalPlans,
      activePlans,
      criticalPlans,
      plansWithCandidates,
      plansWithoutCandidates,
      readiness,
    })
  },
  perm(MODULE.SUCCESSION, ACTION.VIEW),
)
