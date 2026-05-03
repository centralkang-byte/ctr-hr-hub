// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Analytics MV Refresh API
// POST /api/v1/analytics/refresh — MV 수동 리프레시 (SUPER_ADMIN)
// ═══════════════════════════════════════════════════════════

import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { forbidden } from '@/lib/errors'
import { MODULE, ACTION } from '@/lib/constants'
import { refreshAllMVs } from '@/lib/analytics/queries'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (_req, _ctx, user: SessionUser) => {
    // MV 수동 리프레시는 HR 관리자 전용 (MANAGER_UP의 ANALYTICS 자동 허용
    // 우회 차단 — 리프레시는 관리자 고비용 작업)
    const isHrOrAbove = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role)
    if (!isHrOrAbove) throw forbidden('MV 리프레시는 HR 관리자만 실행할 수 있습니다.')

    const results = await refreshAllMVs()
    return apiSuccess({ results })
  },
  perm(MODULE.ANALYTICS, ACTION.APPROVE),
)
