// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/onboarding/checkins/:employeeId
// 특정 직원의 체크인 이력 조회
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { unauthorized, forbidden } from '@/lib/errors'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'

export async function GET(_req: NextRequest, ctx: { params: Promise<Record<string, string>> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return apiError(unauthorized())
    const user = session.user as SessionUser

    const { employeeId } = await ctx.params

    // Self-service: employee can read own checkins
    // HR_ADMIN/SUPER_ADMIN can read any employee's checkins
    const isSelf = user.employeeId === employeeId
    const isHrAdmin = user.role === 'HR_ADMIN' || user.role === 'SUPER_ADMIN'
    if (!isSelf && !isHrAdmin) {
      throw forbidden('본인 또는 HR 관리자만 체크인을 조회할 수 있습니다.')
    }

    const checkins = await prisma.onboardingCheckin.findMany({
      where: { employeeId, ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}) },
      orderBy: { checkinWeek: 'asc' },
    })
    return apiSuccess(checkins)
  } catch (error) {
    return apiError(error)
  }
}
