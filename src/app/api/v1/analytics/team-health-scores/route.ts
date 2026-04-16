// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 팀 건강 스코어 목록 조회 API
// GET /api/v1/analytics/team-health-scores
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { parseAnalyticsParams } from '@/lib/analytics/parse-params'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const params = parseAnalyticsParams(new URL(req.url).searchParams)
    const companyId = params.companyId || user.companyId

    const departments = await prisma.department.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        teamHealthScores: {
          orderBy: { calculatedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            overallScore: true,
            riskLevel: true,
            memberCount: true,
            metrics: true,
            calculatedAt: true,
          },
        },
      },
    })

    const data = departments
      .map((d) => ({
        departmentId: d.id,
        departmentName: d.name,
        latestScore: d.teamHealthScores[0] ?? null,
      }))
      .filter((d) => d.latestScore !== null)
      .sort((a, b) => (b.latestScore?.overallScore ?? 0) - (a.latestScore?.overallScore ?? 0))

    return apiSuccess(data)
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
