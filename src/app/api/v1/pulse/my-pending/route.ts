// ═══════════════════════════════════════════════════════════
// CTR HR Hub — My Pending Pulse Surveys
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withAuth } from '@/lib/permissions'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/pulse/my-pending ────────────────────────

export const GET = withAuth(
  async (_req: NextRequest, _context, user: SessionUser) => {
    const now = new Date()

    // Find active surveys for user's company (include targetScope/targetIds for
    // eligibility filtering — mirrors respond/route.ts eligibility logic).
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
        targetScope: true,
        targetIds: true,
        _count: { select: { questions: true } },
      },
      orderBy: { closeAt: 'asc' },
    })

    // Filter out already-responded surveys.
    // respondentId is an Employee FK — use user.employeeId, not user.id (session subject).
    const respondedSurveyIds = await prisma.pulseResponse.findMany({
      where: {
        respondentId: user.employeeId,
        surveyId: { in: activeSurveys.map((s) => s.id) },
      },
      select: { surveyId: true },
      distinct: ['surveyId'],
    })
    const respondedSet = new Set(respondedSurveyIds.map((r) => r.surveyId))

    // Resolve user's department ancestor chain once for targetScope filter.
    const currentAsgn = await prisma.employeeAssignment.findFirst({
      where: { employeeId: user.employeeId, isPrimary: true, endDate: null },
      select: { departmentId: true },
    })
    const ancestorDeptIds = new Set<string>()
    if (currentAsgn?.departmentId) {
      let cursor: string | null = currentAsgn.departmentId
      while (cursor && !ancestorDeptIds.has(cursor) && ancestorDeptIds.size < 16) {
        ancestorDeptIds.add(cursor)
        const parent: { parentId: string | null } | null = await prisma.department.findUnique({
          where: { id: cursor },
          select: { parentId: true },
        })
        cursor = parent?.parentId ?? null
      }
    }

    // Survey is eligible when scope = ALL, targetIds empty (back-compat), or any
    // ancestor department appears in targetIds. Mirrors respond/route.ts.
    const isEligible = (s: (typeof activeSurveys)[number]): boolean => {
      if (s.targetScope === 'ALL') return true
      const targetIds = Array.isArray(s.targetIds) ? (s.targetIds as string[]) : []
      if (targetIds.length === 0) return true
      return targetIds.some((tid) => ancestorDeptIds.has(tid))
    }

    const pending = activeSurveys
      .filter((s) => !respondedSet.has(s.id))
      .filter(isEligible)
      .map(({ targetScope: _ts, targetIds: _ti, ...rest }) => rest)

    return apiSuccess(pending)
  },
)
