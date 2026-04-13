// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/org/tree
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { withCache, CACHE_STRATEGY } from '@/lib/cache'
import { MODULE, ACTION } from '@/lib/constants'
import { getCrossCompanyReadFilter } from '@/lib/api/cross-company-access'
import type { SessionUser } from '@/types'

// ─── Tree node type ───────────────────────────────────────

type DeptHead = {
  employeeId: string
  name: string
  nameEn: string | null
  title: string | null
}

type DeptNode = {
  id: string
  name: string
  nameEn: string | null
  code: string
  level: number
  sortOrder: number
  parentId: string | null
  employeeCount: number
  head: DeptHead | null
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

export const GET = withCache(withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const companyIdParam = req.nextUrl.searchParams.get('companyId')

    let companyFilter: Record<string, unknown>
    if (user.role === 'SUPER_ADMIN') {
      companyFilter = companyIdParam ? { companyId: companyIdParam } : {}
    } else if (companyIdParam && companyIdParam !== user.companyId) {
      // Non-SUPER_ADMIN requesting another company's tree — verify cross-company access
      const crossFilter = await getCrossCompanyReadFilter({
        callerEmployeeId: user.employeeId,
        callerRole: user.role,
        callerCompanyId: user.companyId,
      })
      if (!crossFilter) {
        companyFilter = { companyId: user.companyId } // deny — show own company
      } else {
        // PATCH 2: Verify via secondary assignment OR dotted-line relationship
        // 1. 내가 해당 법인에 겸직 발령이 있거나
        // 2. 해당 법인에 내 점선 보고자가 있거나
        const myPositionIds = await prisma.employeeAssignment.findMany({
          where: { employeeId: user.employeeId, endDate: null },
          select: { positionId: true },
        }).then((rows) => rows.map((r) => r.positionId).filter((id): id is string => id !== null))

        const hasAccess = await prisma.employeeAssignment.findFirst({
          where: {
            companyId: companyIdParam,
            endDate: null,
            OR: [
              // Case 1: 내가 해당 법인에 겸직 발령
              { isPrimary: false, employeeId: user.employeeId },
              // Case 2: 해당 법인에 내 점선 보고자가 있음
              ...(myPositionIds.length > 0
                ? [{ position: { dottedLinePositionId: { in: myPositionIds } } }]
                : []),
            ],
          },
        })
        companyFilter = hasAccess ? { companyId: companyIdParam } : { companyId: user.companyId }
      }
    } else {
      companyFilter = { companyId: user.companyId }
    }

    const departments = await prisma.department.findMany({
      where: { deletedAt: null, ...companyFilter },
      select: {
        id: true,
        name: true,
        nameEn: true,
        code: true,
        level: true,
        sortOrder: true,
        parentId: true,
        _count: {
          select: {
            assignments: { where: { endDate: null } },
          },
        },
        assignments: {
          where: { endDate: null, isPrimary: true },
          orderBy: { effectiveDate: 'desc' },
          take: 1,
          select: {
            employee: { select: { id: true, name: true, nameEn: true } },
            title: { select: { name: true } },
            jobGrade: { select: { name: true } },
          },
        },
      },
    })

    const flat: Omit<DeptNode, 'children'>[] = departments.map((d) => {
      const asgn = d.assignments[0]
      return {
        id: d.id,
        name: d.name,
        nameEn: d.nameEn,
        code: d.code,
        level: d.level,
        sortOrder: d.sortOrder,
        parentId: d.parentId,
        employeeCount: (d as any)._count.assignments, // eslint-disable-line @typescript-eslint/no-explicit-any
        head: asgn
          ? {
              employeeId: asgn.employee.id,
              name: asgn.employee.name,
              nameEn: asgn.employee.nameEn,
              title: asgn.title?.name ?? asgn.jobGrade?.name ?? null,
            }
          : null,
      }
    })

    const tree = buildTree(flat)

    return apiSuccess({ tree })
  },
  perm(MODULE.ORG, ACTION.VIEW),
), CACHE_STRATEGY.ORG_TREE)
