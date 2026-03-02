// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Succession Readiness Batch Query
// 직원 ID 목록으로 readiness 일괄 조회
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const bodySchema = z.object({
  employeeIds: z.array(z.string()).min(1).max(200),
})

export const POST = withPermission(
  async (req: NextRequest, _context: unknown, user: SessionUser) => {
    const body = await req.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })

    const candidates = await prisma.successionCandidate.findMany({
      where: {
        employeeId: { in: parsed.data.employeeIds },
        plan: { companyId: user.companyId },
      },
      select: { employeeId: true, readiness: true, ranking: true },
      orderBy: { ranking: 'asc' },
      distinct: ['employeeId' as const],
    })

    return apiSuccess(
      candidates.map((c) => ({
        employeeId: c.employeeId,
        readiness: c.readiness,
        ranking: c.ranking,
      })),
    )
  },
  perm(MODULE.SUCCESSION, ACTION.VIEW),
)
