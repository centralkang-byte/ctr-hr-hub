// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compensation AI Recommendation (Stub)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { aiRecommendSchema } from '@/lib/schemas/compensation'
import type { SessionUser } from '@/types'

// ─── POST /api/v1/compensation/simulation/ai-recommend ───
// Stub: returns mock AI recommendation data.
// TODO: Replace with real AI call using compensationRecommendation from @/lib/claude.ts

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = aiRecommendSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { cycleId, employeeId, budgetConstraint, companyAvgRaise } =
      parsed.data

    // ── Stub: Mock AI response ──────────────────────────────
    // In production, this would call:
    //   import { compensationRecommendation } from '@/lib/claude'
    //   const result = await compensationRecommendation({ ... })
    const mockResult = {
      recommendedPct: 4.5,
      reasoning:
        '해당 직원은 EMS 블록 3B(고성과)에 해당하며, 현재 Compa-Ratio가 0.92로 시장 대비 낮은 수준입니다. ' +
        '인재 유지를 위해 평균 이상의 인상률을 권장합니다.',
      riskFactors: [
        '현재 보상 수준이 시장 중위값 대비 8% 낮음',
        '동일 직급 내 보상 형평성 주의 필요',
        '최근 6개월 내 이직 제안을 받은 이력 있음',
      ],
      alternativeActions: [
        '기본급 인상 대신 성과 보너스 지급 고려',
        '직무 전환 또는 승진을 통한 보상 조정',
        '복리후생 패키지 강화 (교육비, 건강검진 등)',
      ],
    }

    // ── Audit log ───────────────────────────────────────────
    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'compensation.aiRecommend',
      resourceType: 'employee',
      resourceId: employeeId,
      companyId: user.companyId,
      changes: { cycleId, employeeId, budgetConstraint, companyAvgRaise },
      ip,
      userAgent,
    })

    return apiSuccess(mockResult)
  },
  perm(MODULE.COMPENSATION, ACTION.VIEW),
)
