// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/bank-transfers/[id]
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/bank-transfers/[id] ─────────────────────

export const GET = withPermission(
  async (
    _req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const companyFilter =
      user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const batch = await prisma.bankTransferBatch.findFirst({
      where: {
        id,
        ...companyFilter,
      },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { items: true } },
      },
    })

    if (!batch) {
      throw notFound('이체 배치를 찾을 수 없습니다.')
    }

    return apiSuccess(batch)
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)
