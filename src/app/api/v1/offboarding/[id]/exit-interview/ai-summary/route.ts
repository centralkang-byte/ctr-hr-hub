// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/offboarding/:id/exit-interview/ai-summary
// 퇴직 면담 AI 분석 요약
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { MODULE, ACTION } from '@/lib/constants'
import { exitInterviewSummary } from '@/lib/claude'
import type { SessionUser } from '@/types'

export const POST = withRateLimit(withPermission(
  async (_req: NextRequest, ctx, user: SessionUser) => {
    const { id } = await ctx.params

    // Fetch offboarding with employee info and exit interview
    // 테넌트 스코핑 = EmployeeOffboarding.companyId 직접 (완료 후에도 AI 요약 가능)
    const offboarding = await prisma.employeeOffboarding.findFirst({
      where: {
        id,
        ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            hireDate: true,
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
      offboarding.companyId ?? user.companyId,
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
  perm(MODULE.OFFBOARDING, ACTION.APPROVE),
), RATE_LIMITS.AI)
