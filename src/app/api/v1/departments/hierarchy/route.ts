// ═══════════════════════════════════════════════════════════
// G-2 QA: Department Hierarchy API
// GET /api/v1/departments/hierarchy?companyId={id}
// Returns parent departments (본부) with children (팀)
// ═══════════════════════════════════════════════════════════

import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { resolveCompanyId } from '@/lib/api/companyFilter'

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    try {
      const requestedCompanyId = new URL(req.url).searchParams.get('companyId')
      const companyId = resolveCompanyId(user, requestedCompanyId)

      const departments = await prisma.department.findMany({
        where: { deletedAt: null, companyId },
        select: {
          id: true,
          name: true,
          nameEn: true,
          parentId: true,
          level: true,
          companyId: true,
          sortOrder: true,
        },
        orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      })

      const topLevel = departments.filter((d) => !d.parentId)
      const childMap = new Map<string, typeof departments>()
      for (const d of departments) {
        if (d.parentId) {
          const existing = childMap.get(d.parentId) || []
          existing.push(d)
          childMap.set(d.parentId, existing)
        }
      }

      const hierarchy = topLevel.map((parent) => ({
        id: parent.id,
        name: parent.name,
        nameEn: parent.nameEn,
        companyId: parent.companyId,
        children: (childMap.get(parent.id) || []).map((child) => ({
          id: child.id,
          name: child.name,
          nameEn: child.nameEn,
        })),
      }))

      return NextResponse.json({ data: hierarchy })
    } catch {
      return NextResponse.json({ data: [] })
    }
  },
  perm(MODULE.ORG, ACTION.VIEW),
)
