// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/settings/job-grades
// 직급 목록 (EmployeeFilterPanel 등에서 사용)
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (_req, _context, user: SessionUser) => {
    const companyFilter =
      user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    const jobGrades = await prisma.jobGrade.findMany({
      where: {
        deletedAt: null,
        ...companyFilter,
      },
      select: {
        id: true,
        code: true,
        name: true,
        rankOrder: true,
        companyId: true,
      },
      orderBy: { rankOrder: 'asc' },
    })

    return apiSuccess(jobGrades)
  },
  perm(MODULE.ORG, ACTION.VIEW),
)
