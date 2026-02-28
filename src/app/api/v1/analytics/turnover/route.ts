// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Analytics Turnover API
// GET /api/v1/analytics/turnover — 이직 분석
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { turnoverQuerySchema } from '@/lib/schemas/analytics'
import {
  getMonthlyResignations,
  getExitReasonSummary,
  getTurnoverByDepartment,
  getExitByResignType,
  getHeadcountSummary,
} from '@/lib/analytics/queries'
import type { TurnoverData } from '@/lib/analytics/types'

export const GET = withPermission(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const { company_id: companyId, months } = turnoverQuerySchema.parse({
      company_id: searchParams.get('company_id') ?? undefined,
      months: searchParams.get('months') ?? undefined,
    })

    const [monthlyRows, reasonRows, deptRows, typeRows, hcRows] = await Promise.all([
      getMonthlyResignations(companyId, months),
      getExitReasonSummary(companyId, months),
      getTurnoverByDepartment(companyId, months),
      getExitByResignType(companyId, months),
      getHeadcountSummary(companyId),
    ])

    const totalHc = Number(hcRows[0]?.total_headcount ?? 1)

    const data: TurnoverData = {
      monthlyTrend: monthlyRows.map((r) => {
        const resignations = Number(r.resignations)
        return {
          month: new Date(r.month).toISOString().slice(0, 7),
          resignations,
          turnover_rate: Math.round((resignations / totalHc) * 12 * 100 * 10) / 10,
        }
      }),
      byReason: reasonRows.map((r) => ({
        reason: r.primary_reason,
        count: Number(r.count),
      })),
      byDepartment: deptRows.map((r) => ({
        department_name: r.department_name,
        turnover_rate: Number(r.turnover_rate),
        resignations: Number(r.resignations),
      })),
      byResignType: typeRows.map((r) => ({
        resign_type: r.resign_type,
        count: Number(r.count),
      })),
    }

    return apiSuccess(data)
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
