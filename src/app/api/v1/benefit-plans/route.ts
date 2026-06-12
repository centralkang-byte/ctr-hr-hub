// src/app/api/v1/benefit-plans/route.ts
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withAuth } from '@/lib/permissions'
import type { SessionUser } from '@/types'

// 직원 self-service (/my/benefits): 본인 회사의 활성 복리후생 항목만 조회 — 신청 대상 목록.
// withPermission(BENEFITS:VIEW)은 EMPLOYEE에게 403을 반환했음. 형제 라우트
// /api/v1/benefit-claims 와 동일한 withAuth self-service 패턴으로 정합. 쿼리가
// user.companyId 로 강제 스코프돼 테넌트 격리는 그대로 유지된다.
export const GET = withAuth(
  async (_req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const plans = await prisma.benefitPlan.findMany({
      where: { companyId: user.companyId, isActive: true, deletedAt: null },
      orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }],
      // self-service에 필요한 필드만 노출 (내부 eligibility JSON·설명 등 제외)
      select: {
        id: true,
        companyId: true,
        code: true,
        name: true,
        category: true,
        benefitType: true,
        amount: true,
        maxAmount: true,
        currency: true,
        frequency: true,
        requiresApproval: true,
        requiresProof: true,
      },
    })
    return apiSuccess(plans)
  },
)
