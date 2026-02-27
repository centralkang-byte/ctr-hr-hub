// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/ai/onboarding-checkin-summary
// AI 체크인 요약 생성
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { onboardingCheckinSummary } from '@/lib/claude'
import type { SessionUser } from '@/types'
import { z } from 'zod'

const MODULE = { ONBOARDING: 'onboarding' }
const ACTION = { APPROVE: 'manage' }

const schema = z.object({ employeeId: z.string().uuid() })

export const POST = withPermission(
  async (req: NextRequest, _ctx: unknown, user: SessionUser) => {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })

    const employee = await prisma.employee.findFirst({
      where: { id: parsed.data.employeeId, ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}) },
    })
    if (!employee) throw notFound('직원을 찾을 수 없습니다.')

    const checkins = await prisma.onboardingCheckin.findMany({
      where: { employeeId: parsed.data.employeeId },
      orderBy: { checkinWeek: 'asc' },
    })
    if (checkins.length === 0) throw badRequest('체크인 데이터가 없습니다.')

    const summary = await onboardingCheckinSummary(
      employee.name,
      checkins.map((c) => ({
        week: c.checkinWeek,
        mood: c.mood,
        energy: c.energy,
        belonging: c.belonging,
        comment: c.comment,
      })),
      user.companyId,
      employee.id,
    )

    // Save AI summary to latest checkin
    const latestCheckin = checkins[checkins.length - 1]
    await prisma.onboardingCheckin.update({
      where: { id: latestCheckin.id },
      data: { aiSummary: JSON.stringify(summary) },
    })

    return apiSuccess({ summary, aiGenerated: true })
  },
  perm(MODULE.ONBOARDING, ACTION.APPROVE),
)
