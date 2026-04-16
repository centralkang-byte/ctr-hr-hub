// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/monitoring/metrics
// API 응답시간 통계 (Redis 저장)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { getApiMetrics } from '@/lib/api-monitor'
import { getCacheStats } from '@/lib/cache'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (_req: NextRequest, _context, _user: SessionUser) => {
    const [metrics, cacheStats] = await Promise.all([
      getApiMetrics(),
      getCacheStats(),
    ])
    return apiSuccess({ ...metrics, cache: cacheStats })
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)
