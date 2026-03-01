// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PII Access Dashboard Stats
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const companyId = user.companyId
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [totalAccess, accessByType, topActors, recentAccess] = await Promise.all([
      prisma.piiAccessLog.count({
        where: { companyId, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.piiAccessLog.groupBy({
        by: ['accessType'],
        where: { companyId, createdAt: { gte: thirtyDaysAgo } },
        _count: true,
        orderBy: { _count: { accessType: 'desc' } },
      }),
      prisma.piiAccessLog.groupBy({
        by: ['actorId'],
        where: { companyId, createdAt: { gte: thirtyDaysAgo } },
        _count: true,
        orderBy: { _count: { actorId: 'desc' } },
        take: 10,
      }),
      prisma.piiAccessLog.count({
        where: { companyId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
    ])

    // Resolve actor names
    const actorIds = topActors.map((a) => a.actorId)
    const actors = actorIds.length > 0
      ? await prisma.employee.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, employeeNo: true },
        })
      : []

    const actorMap = new Map(actors.map((a) => [a.id, a]))

    return apiSuccess({
      totalAccess,
      recentAccess24h: recentAccess,
      accessByType: accessByType.map((a) => ({
        type: a.accessType,
        count: a._count,
      })),
      topActors: topActors.map((a) => ({
        actor: actorMap.get(a.actorId) ?? { id: a.actorId, name: 'Unknown' },
        count: a._count,
      })),
    })
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)
