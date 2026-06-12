// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Analytics Compensation API
// GET /api/v1/analytics/compensation — 보상 분석
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { withCache, CACHE_STRATEGY } from '@/lib/cache'
import { MODULE, ACTION } from '@/lib/constants'
import { analyticsQuerySchema } from '@/lib/schemas/analytics'
import {
  getCompaRatioDistribution,
  getCompaRatioByGrade,
  getCompaBandFit,
} from '@/lib/analytics/queries'
import type { CompensationData } from '@/lib/analytics/types'
import type { SessionUser } from '@/types'
import { resolveCompanyFilter } from '@/lib/api/companyFilter'

// PostgreSQL numeric 컬럼은 raw query에서 문자열로 직렬화됨 → 숫자로 강제 (null 보존)
const toNum = (v: unknown): number | null => {
  if (v == null) return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

export const GET = withCache(withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const { company_id: requestedCompanyId } = analyticsQuerySchema.parse({
      company_id: searchParams.get('company_id') ?? undefined,
    })
    const { companyId } = resolveCompanyFilter(user, requestedCompanyId)

    const [distRows, gradeRows, fitRows] = await Promise.all([
      getCompaRatioDistribution(companyId),
      getCompaRatioByGrade(companyId),
      getCompaBandFit(companyId),
    ])

    const fit = fitRows[0] ?? { under: BigInt(0), in_band: BigInt(0), over: BigInt(0) }

    const data: CompensationData = {
      distribution: distRows.map((r) => ({
        ...r,
        avg_compa_ratio: toNum(r.avg_compa_ratio),
        p25: toNum(r.p25),
        median: toNum(r.median),
        p75: toNum(r.p75),
      })),
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
), CACHE_STRATEGY.ANALYTICS, 'user')
