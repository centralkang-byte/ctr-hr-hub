// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Settings Audit Log API (H-3)
// GET /api/v1/settings-audit-log — paginated audit trail
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      resourceType: 'CompanyProcessSetting',
    }

    // Filter by category (stored in changes.category)
    if (category) {
      where.changes = {
        path: ['category'],
        equals: category.toUpperCase(),
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          actorId: true,
          action: true,
          resourceType: true,
          resourceId: true,
          companyId: true,
          changes: true,
          createdAt: true,
          actor: {
            select: {
              id: true,
              name: true,
              employeeNo: true,
            },
          },
          company: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ])

    return apiSuccess({ logs, total, limit, offset })
  } catch (err) {
    console.error('[Settings Audit Log GET]', err)
    return apiError(err)
  }
}
