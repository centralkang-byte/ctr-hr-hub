// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Insights (통합 사이드패널 데이터)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (
    _req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    _user: SessionUser,
  ) => {
    const { id } = await context.params

    const employee = await prisma.employee.findFirst({
      where: { id },
      select: { id: true, name: true },
    })
    if (!employee) throw notFound('직원을 찾을 수 없습니다.')

    // 1. 최근 MBO 목표 (최대 5개)
    // GoalStatus: DRAFT | PENDING_APPROVAL | APPROVED | REJECTED (CANCELLED 없음)
    const goals = await prisma.mboGoal.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        weight: true,
        status: true,
        targetValue: true,
        achievementScore: true,
      },
    })

    // 2. 최근 원온원 (최근 6개월, 최대 5건)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const oneOnOnes = await prisma.oneOnOne.findMany({
      where: {
        employeeId: id,
        status: 'COMPLETED',
        scheduledAt: { gte: sixMonthsAgo },
      },
      orderBy: { scheduledAt: 'desc' },
      take: 5,
      select: {
        id: true,
        scheduledAt: true,
        notes: true,
        aiSummary: true,
        meetingType: true,
      },
    })

    // 3. 최근 매니저 평가 1건
    const latestEval = await prisma.performanceEvaluation.findFirst({
      where: { employeeId: id, evalType: 'MANAGER' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        performanceScore: true,
        competencyScore: true,
        performanceGrade: true,
        competencyGrade: true,
        emsBlock: true,
        status: true,
        cycle: { select: { name: true } },
      },
    })

    // 4. Succession readiness
    // 생성된 Prisma 클라이언트 기준 필드: readiness, developmentAreas, notes, plan
    const successionEntry = await prisma.successionCandidate.findFirst({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        readiness: true,
        notes: true,
        plan: { select: { positionTitle: true } },
      },
    })

    return apiSuccess({
      employee: { id: employee.id, name: employee.name },
      goals,
      oneOnOnes,
      latestEval,
      successionEntry,
    })
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
