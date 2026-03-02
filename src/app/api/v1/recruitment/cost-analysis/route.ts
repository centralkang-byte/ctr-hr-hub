// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/recruitment/cost-analysis
// Recruitment Cost ROI Analysis
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { costAnalysisQuerySchema } from '@/lib/schemas/recruitment-cost'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/recruitment/cost-analysis ───────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = costAnalysisQuerySchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { year } = parsed.data

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    // Build date filter for invoice date year
    const dateFilter = year
      ? {
          invoiceDate: {
            gte: new Date(`${year}-01-01`),
            lt: new Date(`${year + 1}-01-01`),
          },
        }
      : {}

    const costWhere = { ...companyFilter, ...dateFilter }

    // ── 1. Total cost ────────────────────────────────────
    const totalCostResult = await prisma.recruitmentCost.aggregate({
      where: costWhere,
      _sum: { amount: true },
    })
    const totalCost = Number(totalCostResult._sum.amount ?? 0)

    // ── 2. Total hires (applications with convertedEmployeeId) ──
    const totalHires = await prisma.application.count({
      where: {
        convertedEmployeeId: { not: null },
        posting: companyFilter,
        ...(year
          ? {
              convertedAt: {
                gte: new Date(`${year}-01-01`),
                lt: new Date(`${year + 1}-01-01`),
              },
            }
          : {}),
      },
    })

    // ── 3. Cost per hire ─────────────────────────────────
    const costPerHire = totalHires > 0 ? totalCost / totalHires : 0

    // ── 4. By source ─────────────────────────────────────
    const costBySource = await prisma.recruitmentCost.groupBy({
      by: ['applicantSource'],
      where: costWhere,
      _sum: { amount: true },
      _count: true,
    })

    const bySource = costBySource.map((row) => {
      const cost = Number(row._sum.amount ?? 0)
      return {
        source: row.applicantSource,
        totalCost: cost,
        count: typeof row._count === 'number' ? row._count : 0,
        hires: 0,
        costPerHire: 0,
      }
    })

    // ── 5. By cost type ──────────────────────────────────
    const costByCostType = await prisma.recruitmentCost.groupBy({
      by: ['costType'],
      where: costWhere,
      _sum: { amount: true },
      _count: true,
    })

    const byCostType = costByCostType.map((row) => ({
      costType: row.costType,
      totalAmount: Number(row._sum.amount ?? 0),
      count: typeof row._count === 'number' ? row._count : 0,
    }))

    // ── 6. By posting (top 20) ───────────────────────────
    const costByPosting = await prisma.recruitmentCost.groupBy({
      by: ['postingId'],
      where: { ...costWhere, postingId: { not: null } },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } },
      take: 20,
    })

    const postingIds = costByPosting
      .map((r) => r.postingId)
      .filter((id): id is string => id !== null)

    // Fetch posting details + hire counts in parallel
    const [postings, hireCounts] = await Promise.all([
      prisma.jobPosting.findMany({
        where: { id: { in: postingIds } },
        select: { id: true, title: true, headcount: true },
      }),
      prisma.application.groupBy({
        by: ['postingId'],
        where: {
          postingId: { in: postingIds },
          convertedEmployeeId: { not: null },
        },
        _count: true,
      }),
    ])

    const postingMap = new Map(postings.map((p) => [p.id, p]))
    const hireCountMap = new Map(
      hireCounts.map((h) => [h.postingId, typeof h._count === 'number' ? h._count : 0]),
    )

    const byPosting = costByPosting.map((row) => {
      const posting = row.postingId ? postingMap.get(row.postingId) : null
      const cost = Number(row._sum.amount ?? 0)
      const hires = row.postingId ? (hireCountMap.get(row.postingId) ?? 0) : 0
      return {
        postingId: row.postingId,
        title: posting?.title ?? null,
        headcount: posting?.headcount ?? null,
        totalCost: cost,
        hires,
        costPerHire: hires > 0 ? cost / hires : 0,
      }
    })

    return apiSuccess({
      year: year ?? null,
      totalCost,
      totalHires,
      costPerHire,
      bySource,
      byCostType,
      byPosting,
    })
  },
  perm(MODULE.RECRUITMENT, ACTION.VIEW),
)
