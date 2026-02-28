// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Analytics MV Refresh API
// POST /api/v1/analytics/refresh — MV 수동 리프레시 (SUPER_ADMIN)
// ═══════════════════════════════════════════════════════════

import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { refreshAllMVs } from '@/lib/analytics/queries'

export const POST = withPermission(
  async () => {
    const results = await refreshAllMVs()
    return apiSuccess({ results })
  },
  perm(MODULE.ANALYTICS, ACTION.APPROVE),
)
