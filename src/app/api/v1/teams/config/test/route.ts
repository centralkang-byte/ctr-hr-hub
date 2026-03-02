// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/teams/config/test
// Teams 연결 테스트 (SETTINGS 권한)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { testTeamsConnection } from '@/lib/microsoft-graph'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (_req: NextRequest, _context, _user: SessionUser) => {
    const result = await testTeamsConnection()
    return apiSuccess(result)
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)
