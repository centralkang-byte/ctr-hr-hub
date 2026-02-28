// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Analytics Overview API
// GET /api/v1/analytics/overview — 전사 KPI 6개
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { analyticsQuerySchema } from '@/lib/schemas/analytics'
import {
  getHeadcountSummary,
  getBurnoutRiskCount,
  getAvgOvertimeHours,
} from '@/lib/analytics/queries'
import type { OverviewKpi } from '@/lib/analytics/types'

export const GET = withPermission(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const { company_id: companyId } = analyticsQuerySchema.parse({
      company_id: searchParams.get('company_id') ?? undefined,
    })

    const [headcountRows, burnoutRows, overtimeRows] = await Promise.all([
      getHeadcountSummary(companyId),
      getBurnoutRiskCount(companyId),
      getAvgOvertimeHours(companyId),
    ])

    const hc = headcountRows[0] ?? { total_headcount: BigInt(0), new_hires_30d: BigInt(0), resignations_30d: BigInt(0) }
    const totalHeadcount = Number(hc.total_headcount)
    const newHires30d = Number(hc.new_hires_30d)
    const resignations30d = Number(hc.resignations_30d)

    const turnoverRateAnnualized =
      totalHeadcount > 0
        ? Math.round((resignations30d / totalHeadcount) * 12 * 100 * 10) / 10
        : 0

    const kpi: OverviewKpi = {
      totalHeadcount,
      newHires30d,
      resignations30d,
      turnoverRateAnnualized,
      avgOvertimeHours: Number(overtimeRows[0]?.avg_overtime_hours ?? 0),
      burnoutRiskCount: Number(burnoutRows[0]?.count ?? 0),
    }

    return apiSuccess(kpi)
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
