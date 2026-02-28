// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Analytics Workforce API
// GET /api/v1/analytics/workforce — 인력구성 분석
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { analyticsQuerySchema } from '@/lib/schemas/analytics'
import {
  getHeadcountByDepartment,
  getHeadcountByEmploymentType,
  getHeadcountByGrade,
} from '@/lib/analytics/queries'
import type { WorkforceData } from '@/lib/analytics/types'

export const GET = withPermission(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const { company_id: companyId } = analyticsQuerySchema.parse({
      company_id: searchParams.get('company_id') ?? undefined,
    })

    const [byDept, byType, byGrade] = await Promise.all([
      getHeadcountByDepartment(companyId),
      getHeadcountByEmploymentType(companyId),
      getHeadcountByGrade(companyId),
    ])

    const data: WorkforceData = {
      byDepartment: byDept.map((r) => ({
        department_id: r.department_id,
        department_name: r.department_name,
        headcount: Number(r.headcount),
      })),
      byEmploymentType: byType.map((r) => ({
        employment_type: r.employment_type,
        headcount: Number(r.headcount),
      })),
      byGrade: byGrade.map((r) => ({
        grade_code: r.grade_code,
        grade_name: r.grade_name,
        headcount: Number(r.headcount),
      })),
    }

    return apiSuccess(data)
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
