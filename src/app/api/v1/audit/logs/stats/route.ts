// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/audit/logs/stats
// 감사 로그 통계 (일별 작업 수, 주요 액션 분포)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { auditLogStatsSchema } from '@/lib/schemas/audit'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = auditLogStatsSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { days } = parsed.data
    const since = new Date()
    since.setDate(since.getDate() - days)

    const baseWhere = {
      companyId: user.companyId,
      createdAt: { gte: since },
    }

    // Total count
    const totalLogs = await prisma.auditLog.count({ where: baseWhere })

    // Today's count
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayLogs = await prisma.auditLog.count({
      where: {
        ...baseWhere,
        createdAt: { gte: todayStart },
      },
    })

    // High sensitivity count
    const highSensitivity = await prisma.auditLog.count({
      where: {
        ...baseWhere,
        sensitivityLevel: 'HIGH',
      },
    })

    // Action distribution (top 10)
    const actionDistribution = await prisma.auditLog.groupBy({
      by: ['action'],
      where: baseWhere,
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
      take: 10,
    })

    // Resource type distribution
    const resourceDistribution = await prisma.auditLog.groupBy({
      by: ['resourceType'],
      where: baseWhere,
      _count: { resourceType: true },
      orderBy: { _count: { resourceType: 'desc' } },
      take: 10,
    })

    // Daily counts (last N days)
    const dailyCounts = await prisma.auditLog.groupBy({
      by: ['createdAt'],
      where: baseWhere,
      _count: { id: true },
    })

    // Aggregate daily counts manually
    const dailyMap = new Map<string, number>()
    for (const entry of dailyCounts) {
      const dateKey = entry.createdAt.toISOString().slice(0, 10)
      dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + entry._count.id)
    }

    const dailyData = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))

    return apiSuccess({
      totalLogs,
      todayLogs,
      highSensitivityAccess: highSensitivity,
      actionDistribution: actionDistribution.map((a) => ({
        action: a.action,
        count: a._count.action,
      })),
      resourceDistribution: resourceDistribution.map((r) => ({
        resourceType: r.resourceType,
        count: r._count.resourceType,
      })),
      dailyCounts: dailyData,
    })
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)
