// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/offboarding/:id/exit-interview/ai-summary
// 퇴직 면담 AI 분석 요약
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { exitInterviewSummary } from '@/lib/claude'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (_req: NextRequest, ctx, user: SessionUser) => {
    const { id } = await ctx.params

    // Fetch offboarding with employee info and exit interview
    const offboarding = await prisma.employeeOffboarding.findFirst({
      where: {
        id,
        ...(user.role !== 'SUPER_ADMIN'
          ? { employee: { assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } } } }
          : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            hireDate: true,
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              select: { companyId: true },
            },
          },
        },
      },
    })
    if (!offboarding) throw notFound('퇴직 기록을 찾을 수 없습니다.')

    const interview = await prisma.exitInterview.findFirst({
      where: { employeeOffboardingId: id },
    })
    if (!interview) throw notFound('퇴직 면담이 등록되어 있지 않습니다.')

    // Calculate tenure in months
    const hireDate = offboarding.employee.hireDate
    const tenureMonths = hireDate
      ? Math.round(
          (new Date().getTime() - new Date(hireDate).getTime()) /
            (1000 * 60 * 60 * 24 * 30),
        )
      : 0

    // Call Claude AI for analysis
    const result = await exitInterviewSummary(
      offboarding.employee.name,
      tenureMonths,
      offboarding.resignType,
      interview.primaryReason,
      interview.satisfactionScore,
      interview.feedbackText,
      ((offboarding.employee.assignments?.[0] as any)?.companyId as string | undefined) ?? user.companyId, // eslint-disable-line @typescript-eslint/no-explicit-any
      offboarding.employee.id,
    )

    // Save AI summary to the exit interview record
    const summaryJson = JSON.stringify(result)
    await prisma.exitInterview.update({
      where: { id: interview.id },
      data: { aiSummary: summaryJson },
    })

    return apiSuccess({ summary: result, aiGenerated: true })
  },
  perm(MODULE.ONBOARDING, ACTION.APPROVE),
)
