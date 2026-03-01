// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PII Access Log Query
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiPaginated, buildPagination } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { piiAccessSearchSchema } from '@/lib/schemas/compliance'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = piiAccessSearchSchema.safeParse(params)
    if (!parsed.success) throw badRequest('Invalid parameters', { issues: parsed.error.issues })

    const { page, limit, actorId, targetId, accessType, from, to } = parsed.data
    const where = {
      companyId: user.companyId,
      ...(actorId ? { actorId } : {}),
      ...(targetId ? { targetId } : {}),
      ...(accessType ? { accessType } : {}),
      ...(from || to ? {
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
      } : {}),
    }

    const [logs, total] = await Promise.all([
      prisma.piiAccessLog.findMany({
        where,
        include: {
          actor: { select: { id: true, name: true, employeeNo: true } },
          target: { select: { id: true, name: true, employeeNo: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.piiAccessLog.count({ where }),
    ])

    return apiPaginated(logs, buildPagination(page, limit, total))
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)
