// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/onboarding/checkins/:employeeId
// 특정 직원의 체크인 이력 조회
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { forbidden } from '@/lib/errors'
import { withAuth } from '@/lib/permissions'
import { ROLE } from '@/lib/constants'
import { getActiveTeamMemberIds } from '@/lib/employee/direct-reports'

export const GET = withAuth(async (_req: NextRequest, ctx, user) => {
  const { employeeId } = await ctx.params

  // Self-service: employee can read own checkins
  // HR_ADMIN/SUPER_ADMIN can read any employee's checkins
  // ⑥-C: MANAGER 는 "현재 자사 primary 발령" 직속부하만 (Codex G1 — active same-company 강제)
  const isSelf = user.employeeId === employeeId
  const isHrAdmin = user.role === 'HR_ADMIN' || user.role === 'SUPER_ADMIN'
  const isTeamManager =
    !isSelf &&
    !isHrAdmin &&
    user.role === ROLE.MANAGER &&
    (await getActiveTeamMemberIds(user.employeeId ?? '', user.companyId)).includes(employeeId)
  if (!isSelf && !isHrAdmin && !isTeamManager) {
    throw forbidden('본인, 직속 상사 또는 HR 관리자만 체크인을 조회할 수 있습니다.')
  }

  const checkins = await prisma.onboardingCheckin.findMany({
    where: { employeeId, ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}) },
    orderBy: { checkinWeek: 'asc' },
  })
  return apiSuccess(checkins)
})
