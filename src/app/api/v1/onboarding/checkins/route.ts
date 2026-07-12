// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/onboarding/checkins
// HR 관리자용 전체 체크인 목록 (페이지네이션, 회사 스코프)
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { apiPaginated, buildPagination } from '@/lib/api'
import type { SessionUser } from '@/types'
import { ROLE } from '@/lib/constants'
import { getActiveTeamMemberIds } from '@/lib/employee/direct-reports'

const MODULE = { ONBOARDING: 'onboarding' }
const ACTION = { VIEW: 'read' }

export const GET = withPermission(
  async (req: NextRequest, _ctx: unknown, user: SessionUser) => {
    const p = Object.fromEntries(req.nextUrl.searchParams)
    const page = Number(p.page ?? 1)
    const limit = Number(p.limit ?? 20)
    const companyId = user.role === 'SUPER_ADMIN' ? (p.companyId ?? undefined) : user.companyId

    // ⑥-C: MANAGER 는 직속부하 체크인만 (mood/에너지 등 민감 데이터 법인 전체 노출 차단)
    const teamIds =
      user.role === ROLE.MANAGER
        ? await getActiveTeamMemberIds(user.employeeId ?? '', user.companyId)
        : null

    const where = {
      ...(companyId ? { companyId } : {}),
      ...(teamIds ? { employeeId: { in: teamIds } } : {}),
    }
    const [total, checkins] = await Promise.all([
      prisma.onboardingCheckin.count({ where }),
      prisma.onboardingCheckin.findMany({
        where,
        include: { employee: { select: { id: true, name: true } } },
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])
    return apiPaginated(checkins, buildPagination(page, limit, total))
  },
  perm(MODULE.ONBOARDING, ACTION.VIEW),
)
