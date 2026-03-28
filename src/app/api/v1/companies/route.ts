// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/companies
// Alias for /api/v1/org/companies (multiple pages reference this path)
// ═══════════════════════════════════════════════════════════

import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { MODULE, ACTION } from '@/lib/constants'

export const GET = withPermission(
  async () => {
    const companies = await prisma.company.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        nameEn: true,
        countryCode: true,
        currency: true,
      },
      orderBy: { code: 'asc' },
    })
    return apiSuccess(companies)
  },
  perm(MODULE.ORG, ACTION.VIEW),
)
