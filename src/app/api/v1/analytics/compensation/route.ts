// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Analytics Compensation API
// GET /api/v1/analytics/compensation — 보상 분석
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { analyticsQuerySchema } from '@/lib/schemas/analytics'
import {
  getCompaRatioDistribution,
  getCompaRatioByGrade,
  getCompaBandFit,
} from '@/lib/analytics/queries'
import type { CompensationData } from '@/lib/analytics/types'

export const GET = withPermission(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const { company_id: companyId } = analyticsQuerySchema.parse({
      company_id: searchParams.get('company_id') ?? undefined,
    })

    const [distRows, gradeRows, fitRows] = await Promise.all([
      getCompaRatioDistribution(companyId),
      getCompaRatioByGrade(companyId),
      getCompaBandFit(companyId),
    ])

    const fit = fitRows[0] ?? { under: BigInt(0), in_band: BigInt(0), over: BigInt(0) }

    const data: CompensationData = {
      distribution: distRows,
      byGrade: gradeRows.map((r) => ({
        grade_code: r.grade_code,
        grade_name: r.grade_name,
        avg_compa_ratio: Number(r.avg_compa_ratio),
      })),
      bandFit: {
        under: Number(fit.under),
        in_band: Number(fit.in_band),
        over: Number(fit.over),
      },
    }

    return apiSuccess(data)
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
