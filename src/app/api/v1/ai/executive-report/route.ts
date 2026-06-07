// ═══════════════════════════════════════════════════════════
// CTR HR Hub — AI Executive Report API
// POST /api/v1/ai/executive-report — AI 경영진 보고서 생성
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { aiReportGenerateSchema } from '@/lib/schemas/analytics'
import { generateExecutiveReport } from '@/lib/analytics/ai-report'
import type { SessionUser } from '@/types'

export const POST = withRateLimit(withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const body = await req.json()
    const { company_id } = aiReportGenerateSchema.parse(body)
    // 비-SUPER는 본인 법인 강제; SUPER는 요청 법인(또는 그룹 전체 undefined) 유지
    const companyId = user.role === ROLE.SUPER_ADMIN ? company_id : user.companyId

    const report = await generateExecutiveReport(companyId, user)

    return apiSuccess(report)
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
), RATE_LIMITS.AI)
