import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { MODULE, ACTION } from '@/lib/constants'

// GET /api/v1/org/companies — 활성 법인 목록
export const GET = withPermission(
  async () => {
    const companies = await prisma.company.findMany({
      where: { isActive: true, deletedAt: null },
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
  perm(MODULE.ORG, ACTION.VIEW)
)
