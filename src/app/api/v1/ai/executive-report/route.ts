// ═══════════════════════════════════════════════════════════
// CTR HR Hub — AI Executive Report API
// POST /api/v1/ai/executive-report — AI 경영진 보고서 생성
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { aiReportGenerateSchema } from '@/lib/schemas/analytics'
import { generateExecutiveReport } from '@/lib/analytics/ai-report'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const body = await req.json()
    const { company_id: companyId } = aiReportGenerateSchema.parse(body)

    const report = await generateExecutiveReport(companyId, user)

    return apiSuccess(report)
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
