// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /api/v1/grade-title-mappings
// 프론트엔드용 Grade↔Title 매핑 조회 (직원 등록/수정 시 사용)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('companyId') ?? user.companyId

    const mappings = await prisma.gradeTitleMapping.findMany({
      where: {
        companyId,
        jobGrade: { deletedAt: null },
        employeeTitle: { deletedAt: null },
      },
      include: {
        jobGrade: {
          select: { id: true, code: true, name: true, gradeType: true, rankOrder: true },
        },
        employeeTitle: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: { jobGrade: { rankOrder: 'asc' } },
    })

    return apiSuccess(mappings)
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
