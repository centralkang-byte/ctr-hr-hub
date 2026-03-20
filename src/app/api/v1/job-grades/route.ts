// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/job-grades
// Returns all job grades (for dropdown population)
// ═══════════════════════════════════════════════════════════

import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { MODULE, ACTION } from '@/lib/constants'

export const GET = withPermission(
  async () => {
    const jobGrades = await prisma.jobGrade.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, code: true, rankOrder: true, companyId: true },
      orderBy: { rankOrder: 'asc' },
    })

    return apiSuccess(jobGrades)
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
