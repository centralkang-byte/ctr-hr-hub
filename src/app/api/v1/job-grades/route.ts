// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/job-grades
// Returns all job grades (for dropdown population)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { MODULE, ACTION } from '@/lib/constants'
import { resolveCompanyFilter } from '@/lib/api/companyFilter'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const jobGrades = await prisma.jobGrade.findMany({
      // 비-SUPER는 본인 법인 강제(param 무시), SUPER는 param 또는 전체뷰
      where: { deletedAt: null, ...resolveCompanyFilter(user, searchParams.get('companyId')) },
      select: { id: true, name: true, code: true, rankOrder: true, companyId: true },
      orderBy: { rankOrder: 'asc' },
    })

    return apiSuccess(jobGrades)
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
