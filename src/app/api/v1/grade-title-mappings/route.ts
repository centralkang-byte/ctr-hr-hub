// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /api/v1/grade-title-mappings
// 프론트엔드용 Grade↔Title 매핑 조회 (직원 등록/수정 시 사용)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { resolveCompanyId } from '@/lib/api/companyFilter'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    // 비-SUPER는 본인 법인 강제(param 주입 차단), SUPER는 param 또는 본인 법인
    const companyId = resolveCompanyId(user, searchParams.get('companyId'))

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
