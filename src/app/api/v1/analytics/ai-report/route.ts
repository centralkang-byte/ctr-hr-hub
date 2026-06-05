// ═══════════════════════════════════════════════════════════
// G-2: AI Report List + Detail API
// GET /api/v1/analytics/ai-report — list reports
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { resolveCompanyFilter } from '@/lib/api/companyFilter'

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    try {
      const searchParams = new URL(req.url).searchParams
      const companyFilter = resolveCompanyFilter(user, searchParams.get('companyId'))
      const limit = parseInt(searchParams.get('limit') || '12', 10)

      const reports = await prisma.aiReport.findMany({
        where: {
          ...companyFilter,
          status: 'GENERATED',
        },
        orderBy: { period: 'desc' },
        take: limit,
        select: {
          id: true,
          companyId: true,
          period: true,
          content: true,
          metadata: true,
          status: true,
          createdAt: true,
          company: { select: { name: true } },
        },
      })

      // Double-wrap fix: apiSuccess already wraps as { data: x }. Passing
      // { data: reports } produced { data: { data: [...] } } and forced the
      // UI to fall back at AiReportClient.tsx:51. Return the array directly —
      // UI fallback `j.data?.data || j.data || []` still works.
      return apiSuccess(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reports.map((r: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma result mapping callback
          ...r,
          companyName: r.company?.name || '전사',
        })),
      )
    } catch (error) {
      return apiError(error)
    }
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
