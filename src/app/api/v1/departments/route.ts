// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/departments?companyId=X
// Returns departments filtered by companyId (for dropdown population)
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

    // 비-SUPER는 본인 법인 강제(param 무시), SUPER는 param 또는 전체뷰
    const where: Record<string, unknown> = { deletedAt: null, ...resolveCompanyFilter(user, searchParams.get('companyId')) }

    const departments = await prisma.department.findMany({
      where,
      select: { id: true, name: true, nameEn: true, companyId: true, code: true },
      orderBy: { name: 'asc' },
    })

    return apiSuccess(departments)
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
