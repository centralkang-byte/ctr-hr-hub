// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/departments?companyId=X
// Returns departments filtered by companyId (for dropdown population)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { MODULE, ACTION } from '@/lib/constants'

export const GET = withPermission(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('companyId')

    const where: Record<string, unknown> = { isActive: true, deletedAt: null }
    if (companyId) where.companyId = companyId

    const departments = await prisma.department.findMany({
      where,
      select: { id: true, name: true, nameEn: true, companyId: true, code: true },
      orderBy: { name: 'asc' },
    })

    return apiSuccess(departments)
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
