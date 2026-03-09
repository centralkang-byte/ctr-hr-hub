// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/recruitment/board
// 전체 공고별 스윔레인 칸반 보드 데이터 반환
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (_req: NextRequest, _context, user: SessionUser) => {
    const companyFilter =
      user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    // Fetch OPEN postings (max 20) with their non-rejected applications
    const postings = await prisma.jobPosting.findMany({
      where: {
        status: 'OPEN',
        deletedAt: null,
        ...companyFilter,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        headcount: true,
        department: { select: { id: true, name: true } },
        applications: {
          where: { stage: { not: 'REJECTED' } },
          orderBy: { appliedAt: 'desc' },
          take: 200,
          select: {
            id: true,
            postingId: true,
            stage: true,
            aiScreeningScore: true,
            aiScreeningSummary: true,
            rejectionReason: true,
            offeredSalary: true,
            offeredDate: true,
            expectedStartDate: true,
            appliedAt: true,
            updatedAt: true,
            applicant: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                source: true,
                portfolioUrl: true,
              },
            },
          },
        },
      },
    })

    // Serialize Decimal fields
    const data = postings.map((posting) => ({
      ...posting,
      applications: posting.applications.map((app) => ({
        ...app,
        offeredSalary: app.offeredSalary ? Number(app.offeredSalary) : null,
      })),
    }))

    return apiSuccess({ postings: data })
  },
  perm(MODULE.RECRUITMENT, ACTION.VIEW),
)
