// ═══════════════════════════════════════════════════════════
// CTR HR Hub — My Pending Pulse Surveys
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/pulse/my-pending ────────────────────────

export const GET = withPermission(
  async (_req: NextRequest, _context, user: SessionUser) => {
    const now = new Date()

    // Find active surveys for user's company
    const activeSurveys = await prisma.pulseSurvey.findMany({
      where: {
        companyId: user.companyId,
        deletedAt: null,
        status: 'PULSE_ACTIVE',
        openAt: { lte: now },
        closeAt: { gte: now },
      },
      select: {
        id: true,
        title: true,
        description: true,
        closeAt: true,
        _count: { select: { questions: true } },
      },
      orderBy: { closeAt: 'asc' },
    })

    // Filter out already-responded surveys
    const respondedSurveyIds = await prisma.pulseResponse.findMany({
      where: {
        respondentId: user.id,
        surveyId: { in: activeSurveys.map((s) => s.id) },
      },
      select: { surveyId: true },
      distinct: ['surveyId'],
    })
    const respondedSet = new Set(respondedSurveyIds.map((r) => r.surveyId))

    const pending = activeSurveys.filter((s) => !respondedSet.has(s.id))

    return apiSuccess(pending)
  },
  perm(MODULE.PULSE, ACTION.VIEW),
)
