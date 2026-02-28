// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Analytics Performance API
// GET /api/v1/analytics/performance — 성과 분석
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { performanceQuerySchema } from '@/lib/schemas/analytics'
import {
  getEmsBlockDistribution,
  getPerformanceByDepartment,
} from '@/lib/analytics/queries'
import type { PerformanceData } from '@/lib/analytics/types'

export const GET = withPermission(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const { company_id: companyId, cycle_id: cycleId } = performanceQuerySchema.parse({
      company_id: searchParams.get('company_id') ?? undefined,
      cycle_id: searchParams.get('cycle_id') ?? undefined,
    })

    const [emsRows, deptRows] = await Promise.all([
      getEmsBlockDistribution(cycleId, companyId),
      getPerformanceByDepartment(cycleId, companyId),
    ])

    const data: PerformanceData = {
      emsDistribution: emsRows.map((r) => ({
        ems_block: r.ems_block,
        employee_count: Number(r.employee_count),
      })),
      byDepartment: deptRows.map((r) => ({
        department_name: r.department_name,
        avg_score: Number(r.avg_score),
      })),
      gradeDistribution: [],
    }

    return apiSuccess(data)
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
