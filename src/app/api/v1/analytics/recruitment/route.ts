// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Analytics Recruitment API
// GET /api/v1/analytics/recruitment — 채용 분석
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { analyticsQuerySchema } from '@/lib/schemas/analytics'
import {
  getRecruitmentFunnel,
  getRecruitmentByPosting,
} from '@/lib/analytics/queries'
import type { RecruitmentData } from '@/lib/analytics/types'

export const GET = withPermission(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const { company_id: companyId } = analyticsQuerySchema.parse({
      company_id: searchParams.get('company_id') ?? undefined,
    })

    const [funnelRows, postingRows] = await Promise.all([
      getRecruitmentFunnel(companyId),
      getRecruitmentByPosting(companyId),
    ])

    const data: RecruitmentData = {
      funnel: funnelRows.map((r) => ({
        stage: r.stage,
        candidate_count: Number(r.candidate_count),
      })),
      conversionByPosting: postingRows.map((r) => ({
        posting_id: r.posting_id,
        posting_title: r.posting_title,
        stage: r.stage,
        candidate_count: r.candidate_count,
        avg_screening_score: r.avg_screening_score,
      })),
      avgHiringDays: null,
    }

    return apiSuccess(data)
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
