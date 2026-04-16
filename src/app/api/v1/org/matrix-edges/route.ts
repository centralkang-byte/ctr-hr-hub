// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/org/matrix-edges
// Position.dottedLinePositionId 기반 부서 간 매트릭스 보고 연결
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const companyIdParam = req.nextUrl.searchParams.get('companyId')

    // 회사 접근 제어: SA만 전체/타법인 조회 가능, 일반은 자기 회사만
    let companyFilter: Record<string, unknown> = {}
    if (user.role === 'SUPER_ADMIN') {
      if (companyIdParam) companyFilter = { companyId: companyIdParam }
    } else {
      companyFilter = { companyId: user.companyId }
    }

    // 점선 보고 관계가 있는 Position 쌍 → 부서 간 매핑
    const positions = await prisma.position.findMany({
      where: {
        dottedLinePositionId: { not: null },
        departmentId: { not: null },
        deletedAt: null,
        ...companyFilter,
      },
      select: {
        departmentId: true,
        dottedLineTo: {
          select: { departmentId: true },
        },
      },
    })

    // 부서 간 unique pair로 집약
    const pairSet = new Set<string>()
    const edges: Array<{ fromDeptId: string; toDeptId: string }> = []

    for (const pos of positions) {
      const from = pos.departmentId
      const to = pos.dottedLineTo?.departmentId
      if (!from || !to || from === to) continue
      const key = [from, to].sort().join('|')
      if (pairSet.has(key)) continue
      pairSet.add(key)
      edges.push({ fromDeptId: from, toDeptId: to })
    }

    return apiSuccess({ edges })
  },
  perm(MODULE.ORG, ACTION.VIEW),
)
