// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/recruitment/postings/summary
// 채용 목록 상단 KPI 스트립용 회사-범위 요약 (OPEN 공고 기준).
// 목록 라우트와 동일 allowlist(POSTINGS_READ_ROLES) — KPI 청중 == 목록 청중.
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { forbidden } from '@/lib/errors'
import { withAuth } from '@/lib/permissions'
import { ROLE } from '@/lib/constants'
import { POSTINGS_READ_ROLES, bucketStages } from '@/lib/recruitment/access'
import type { SessionUser } from '@/types'
import type { ApplicationStage } from '@/generated/prisma/enums'

// ─── GET /api/v1/recruitment/postings/summary ─────────────

export const GET = withAuth(
  async (_req: NextRequest, _context, user: SessionUser) => {
    if (!POSTINGS_READ_ROLES.includes(user.role)) {
      throw forbidden('채용 공고 조회 권한이 없습니다.')
    }

    const companyFilter =
      user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }
    // 진행 중(OPEN) + 미삭제 공고만 — 활성 채용 스냅샷.
    const openPostingFilter = {
      ...companyFilter,
      status: 'OPEN' as const,
      deletedAt: null,
    }

    const [activePostings, stageGroups] = await Promise.all([
      prisma.jobPosting.count({ where: openPostingFilter }),
      prisma.application.groupBy({
        by: ['stage'],
        where: { posting: openPostingFilter },
        _count: { _all: true },
      }),
    ])

    const counts: Partial<Record<ApplicationStage, number>> = {}
    for (const g of stageGroups) {
      counts[g.stage] = g._count._all
    }
    const buckets = bucketStages(counts)

    return apiSuccess({
      activePostings,
      totalApplicants: buckets.applied,
      inInterview: buckets.interview,
      offersOut: buckets.offer,
    })
  },
)
