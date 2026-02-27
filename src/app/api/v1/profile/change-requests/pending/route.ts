// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/profile/change-requests/pending
// HR 관리자용 — 전체 대기 중 프로필 변경 요청 목록
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── GET — 대기 중 변경 요청 목록 (HR 관리자) ─────────────────

export const GET = withPermission(
  async (
    _req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    // SUPER_ADMIN sees all; others see only their company
    const companyFilter =
      user.role === ROLE.SUPER_ADMIN
        ? {}
        : { employee: { companyId: user.companyId } }

    const requests = await prisma.profileChangeRequest.findMany({
      where: {
        status: 'CHANGE_PENDING',
        ...companyFilter,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        employee: { select: { id: true, name: true, employeeNo: true } },
      },
    })

    return apiSuccess(requests)
  },
  perm(MODULE.EMPLOYEES, ACTION.APPROVE),
)
