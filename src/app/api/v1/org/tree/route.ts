// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/org/tree
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Tree node type ───────────────────────────────────────

type DeptNode = {
  id: string
  name: string
  nameEn: string | null
  code: string
  level: number
  sortOrder: number
  isActive: boolean
  parentId: string | null
  employeeCount: number
  children: DeptNode[]
}

function buildTree(flat: Omit<DeptNode, 'children'>[]): DeptNode[] {
  const nodeMap = new Map<string, DeptNode>()
  const roots: DeptNode[] = []

  for (const dept of flat) {
    nodeMap.set(dept.id, { ...dept, children: [] })
  }

  for (const node of Array.from(nodeMap.values())) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  function sortChildren(nodes: DeptNode[]): void {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder)
    for (const n of nodes) sortChildren(n.children)
  }
  sortChildren(roots)

  return roots
}

// ─── GET /api/v1/org/tree ─────────────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const companyIdParam = req.nextUrl.searchParams.get('companyId')
    const companyFilter =
      user.role === 'SUPER_ADMIN'
        ? companyIdParam
          ? { companyId: companyIdParam }
          : {}
        : { companyId: user.companyId }

    const departments = await prisma.department.findMany({
      where: { deletedAt: null, ...companyFilter },
      select: {
        id: true,
        name: true,
        nameEn: true,
        code: true,
        level: true,
        sortOrder: true,
        isActive: true,
        parentId: true,
        _count: {
          select: {
            employees: { where: { deletedAt: null } },
          },
        },
      },
    })

    const flat: Omit<DeptNode, 'children'>[] = departments.map((d) => ({
      id: d.id,
      name: d.name,
      nameEn: d.nameEn,
      code: d.code,
      level: d.level,
      sortOrder: d.sortOrder,
      isActive: d.isActive,
      parentId: d.parentId,
      employeeCount: d._count.employees,
    }))

    const tree = buildTree(flat)

    return apiSuccess({ tree })
  },
  perm(MODULE.ORG, ACTION.VIEW),
)
