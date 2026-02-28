// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Analytics Team Health API
// GET /api/v1/analytics/team-health — 팀 건강 분석
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { analyticsQuerySchema } from '@/lib/schemas/analytics'
import {
  getTeamHealthList,
  getBurnoutRiskList,
} from '@/lib/analytics/queries'
import type { TeamHealthData } from '@/lib/analytics/types'

export const GET = withPermission(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const { company_id: companyId } = analyticsQuerySchema.parse({
      company_id: searchParams.get('company_id') ?? undefined,
    })

    const [teams, burnoutList] = await Promise.all([
      getTeamHealthList(companyId),
      getBurnoutRiskList(companyId),
    ])

    const data: TeamHealthData = { teams, burnoutList }

    return apiSuccess(data)
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
