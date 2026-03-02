// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/teams/channels
// Graph API로 Teams 팀/채널 목록 조회 (SETTINGS 권한)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { listTeamsChannels } from '@/lib/microsoft-graph'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, _user: SessionUser) => {
    const teamId = req.nextUrl.searchParams.get('teamId') ?? undefined
    const result = await listTeamsChannels(teamId)

    if (result.error) {
      return apiSuccess({ error: result.error })
    }

    return apiSuccess(result)
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)
